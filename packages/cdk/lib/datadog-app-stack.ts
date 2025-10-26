import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface DatadogAppStackProps extends cdk.StackProps {
  /**
   * Environment name (e.g., dev, staging, prod)
   */
  environment?: string;

  /**
   * Datadog API key (will be stored in Secrets Manager)
   * If not provided, you must manually create the secret
   */
  datadogApiKey?: string;

  /**
   * Datadog site (default: datadoghq.com)
   */
  datadogSite?: string;

  /**
   * Number of tasks to run (default: 1)
   */
  desiredCount?: number;

  /**P
   * Container CPU (default: 256)
   */
  cpu?: number;

  /**
   * Container memory in MB (default: 512)
   */
  memory?: number;
}

export class DatadogAppStack extends cdk.Stack {
  public readonly ecrRepository: ecr.Repository;
  public readonly loadBalancerUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props?: DatadogAppStackProps) {
    super(scope, id, props);

    const envName = props?.environment || 'dev';
    const datadogSite = props?.datadogSite || 'datadoghq.com';
    const desiredCount = props?.desiredCount || 1;
    const cpu = props?.cpu || 256;
    const memory = props?.memory || 512;

    // ========================================
    // VPC
    // ========================================
    const vpc = new ec2.Vpc(this, 'DatadogAppVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // ========================================
    // ECR Repository
    // ========================================
    this.ecrRepository = new ecr.Repository(this, 'AppRepository', {
      repositoryName: 'test-datadog-crud-api',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For learning - change to RETAIN for production
      autoDeleteImages: true, // For learning - remove for production
      imageScanOnPush: true,
      lifecycleRules: [
        {
          description: 'Keep last 5 images',
          maxImageCount: 5,
        },
      ],
    });

    // ========================================
    // Secrets Manager - Datadog API Key
    // ========================================
    let datadogApiKeySecret: secretsmanager.ISecret;

    if (props?.datadogApiKey) {
      datadogApiKeySecret = new secretsmanager.Secret(this, 'DatadogApiKey', {
        secretName: `datadog-api-key-${envName}`,
        description: 'Datadog API Key for APM and logging',
        secretStringValue: cdk.SecretValue.unsafePlainText(props.datadogApiKey),
      });
    } else {
      // Import existing secret or create placeholder
      datadogApiKeySecret = secretsmanager.Secret.fromSecretNameV2(
        this,
        'DatadogApiKey',
        `datadog-api-key-${envName}`
      );
    }

    // ========================================
    // CloudWatch Log Groups
    // ========================================
    const appLogGroup = new logs.LogGroup(this, 'AppLogGroup', {
      logGroupName: `/ecs/test-datadog-crud-api-${envName}`,
      retention: logs.RetentionDays.ONE_WEEK, // For learning - adjust for production
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For learning - change to RETAIN for production
    });

    const datadogAgentLogGroup = new logs.LogGroup(this, 'DatadogAgentLogGroup', {
      logGroupName: `/ecs/datadog-agent-${envName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ========================================
    // ECS Cluster
    // ========================================
    const cluster = new ecs.Cluster(this, 'DatadogAppCluster', {
      clusterName: `datadog-test-cluster-${envName}`,
      vpc,
      containerInsights: true, // Enable Container Insights
    });

    // ========================================
    // ECS Task Definition
    // ========================================
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'AppTaskDef', {
      family: `test-datadog-crud-api-${envName}`,
      cpu,
      memoryLimitMiB: memory,
    });

    // Grant permissions to read Datadog API key
    datadogApiKeySecret.grantRead(taskDefinition.taskRole);

    // Datadog Agent Sidecar Container
    const datadogAgentContainer = taskDefinition.addContainer('DatadogAgent', {
      containerName: 'datadog-agent',
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/datadog/agent:latest'),
      cpu: 128,
      memoryLimitMiB: 256,
      essential: true,
      environment: {
        DD_SITE: datadogSite,
        DD_APM_ENABLED: 'true',
        DD_APM_NON_LOCAL_TRAFFIC: 'true',
        ECS_FARGATE: 'true',
        DD_DOGSTATSD_NON_LOCAL_TRAFFIC: 'true',
      },
      secrets: {
        DD_API_KEY: ecs.Secret.fromSecretsManager(datadogApiKeySecret),
      },
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'datadog-agent',
        logGroup: datadogAgentLogGroup,
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'agent health'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Application Container
    const appContainer = taskDefinition.addContainer('AppContainer', {
      containerName: 'app',
      image: ecs.ContainerImage.fromEcrRepository(this.ecrRepository, 'latest'),
      cpu: 128,
      memoryLimitMiB: 256,
      essential: true,
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
        DD_SERVICE: 'test-datadog-crud-api',
        DD_ENV: envName,
        DD_VERSION: '1.0.0',
        DD_AGENT_HOST: 'localhost', // Sidecar pattern
        DD_TRACE_AGENT_PORT: '8126',
        DD_LOGS_INJECTION: 'true',
        DD_RUNTIME_METRICS_ENABLED: 'true',
        DD_PROFILING_ENABLED: 'true',
      },
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'app',
        logGroup: appLogGroup,
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Port mapping for the application
    appContainer.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP,
    });

    // Container dependency - app depends on datadog agent
    appContainer.addContainerDependencies({
      container: datadogAgentContainer,
      condition: ecs.ContainerDependencyCondition.HEALTHY,
    });

    // ========================================
    // Application Load Balancer
    // ========================================
    const alb = new elbv2.ApplicationLoadBalancer(this, 'AppLoadBalancer', {
      vpc,
      internetFacing: true,
      loadBalancerName: `datadog-app-alb-${envName}`,
    });

    // ALB Security Group
    const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc,
      description: 'Security group for ALB',
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic from anywhere'
    );

    alb.addSecurityGroup(albSecurityGroup);

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'AppTargetGroup', {
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // Listener
    const listener = alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [targetGroup],
    });

    // ========================================
    // ECS Service
    // ========================================
    const serviceSecurityGroup = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', {
      vpc,
      description: 'Security group for ECS Service',
      allowAllOutbound: true,
    });

    // Allow traffic from ALB to ECS service
    serviceSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(3000),
      'Allow traffic from ALB'
    );

    const service = new ecs.FargateService(this, 'AppService', {
      cluster,
      taskDefinition,
      serviceName: `test-datadog-crud-api-service-${envName}`,
      desiredCount,
      assignPublicIp: false, // Use private subnets
      securityGroups: [serviceSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
    });

    // Attach service to target group
    service.attachToApplicationTargetGroup(targetGroup);

    // Auto Scaling (optional but useful for learning)
    const scaling = service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 4,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // ========================================
    // Outputs
    // ========================================
    this.loadBalancerUrl = new cdk.CfnOutput(this, 'LoadBalancerUrl', {
      value: `http://${alb.loadBalancerDnsName}`,
      description: 'URL of the Application Load Balancer',
      exportName: `DatadogAppAlbUrl-${envName}`,
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: this.ecrRepository.repositoryUri,
      description: 'ECR Repository URI',
      exportName: `DatadogAppEcrUri-${envName}`,
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      description: 'ECS Cluster Name',
      exportName: `DatadogAppClusterName-${envName}`,
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: service.serviceName,
      description: 'ECS Service Name',
      exportName: `DatadogAppServiceName-${envName}`,
    });

    new cdk.CfnOutput(this, 'SecretArn', {
      value: datadogApiKeySecret.secretArn,
      description: 'Datadog API Key Secret ARN',
      exportName: `DatadogApiKeySecretArn-${envName}`,
    });
  }
}
