import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { DatadogAppStack } from '../lib/datadog-app-stack';

describe('DatadogAppStack', () => {
  let app: cdk.App;
  let stack: DatadogAppStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new DatadogAppStack(app, 'TestStack', {
      environment: 'test',
      datadogApiKey: 'test-api-key',
      datadogSite: 'datadoghq.com',
      desiredCount: 1,
      cpu: 256,
      memory: 512,
    });
    template = Template.fromStack(stack);
  });

  describe('VPC', () => {
    it('should create a VPC', () => {
      template.resourceCountIs('AWS::EC2::VPC', 1);
    });

    it('should create public and private subnets', () => {
      // Should have at least 2 subnets (public and private across AZs)
      const subnets = template.findResources('AWS::EC2::Subnet');
      expect(Object.keys(subnets).length).toBeGreaterThanOrEqual(2);
    });

    it('should create NAT gateways', () => {
      template.resourceCountIs('AWS::EC2::NatGateway', 1);
    });

    it('should create internet gateway', () => {
      template.resourceCountIs('AWS::EC2::InternetGateway', 1);
    });
  });

  describe('ECR Repository', () => {
    it('should create an ECR repository', () => {
      template.resourceCountIs('AWS::ECR::Repository', 1);
    });

    it('should have correct repository name', () => {
      template.hasResourceProperties('AWS::ECR::Repository', {
        RepositoryName: 'test-datadog-crud-api',
        ImageScanningConfiguration: {
          ScanOnPush: true,
        },
      });
    });

    it('should have lifecycle policy', () => {
      template.hasResourceProperties('AWS::ECR::Repository', {
        LifecyclePolicy: Match.objectLike({
          LifecyclePolicyText: Match.anyValue(),
        }),
      });
    });
  });

  describe('Secrets Manager', () => {
    it('should create Datadog API key secret', () => {
      template.resourceCountIs('AWS::SecretsManager::Secret', 1);
    });

    it('should have correct secret name', () => {
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        Name: 'datadog-api-key-test',
      });
    });
  });

  describe('CloudWatch Log Groups', () => {
    it('should create log groups for app and Datadog agent', () => {
      template.resourceCountIs('AWS::Logs::LogGroup', 2);
    });

    it('should create app log group with correct name', () => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/ecs/test-datadog-crud-api-test',
        RetentionInDays: 7,
      });
    });

    it('should create Datadog agent log group with correct name', () => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/ecs/datadog-agent-test',
        RetentionInDays: 7,
      });
    });
  });

  describe('ECS Cluster', () => {
    it('should create an ECS cluster', () => {
      template.resourceCountIs('AWS::ECS::Cluster', 1);
    });

    it('should have correct cluster name', () => {
      template.hasResourceProperties('AWS::ECS::Cluster', {
        ClusterName: 'datadog-test-cluster-test',
      });
    });

    it('should enable Container Insights', () => {
      template.hasResourceProperties('AWS::ECS::Cluster', {
        ClusterSettings: [
          {
            Name: 'containerInsights',
            Value: 'enabled',
          },
        ],
      });
    });
  });

  describe('ECS Task Definition', () => {
    it('should create a Fargate task definition', () => {
      template.resourceCountIs('AWS::ECS::TaskDefinition', 1);
    });

    it('should have correct CPU and memory', () => {
      template.hasResourceProperties('AWS::ECS::TaskDefinition', {
        Cpu: '256',
        Memory: '512',
        RequiresCompatibilities: ['FARGATE'],
        NetworkMode: 'awsvpc',
      });
    });

    it('should have two containers (app and Datadog agent)', () => {
      const taskDefs = template.findResources('AWS::ECS::TaskDefinition');
      const taskDef = Object.values(taskDefs)[0] as any;
      const containerNames = taskDef.Properties.ContainerDefinitions.map((c: any) => c.Name);

      expect(containerNames).toContain('app');
      expect(containerNames).toContain('datadog-agent');
      expect(containerNames.length).toBe(2);
    });

    it('should configure Datadog agent container correctly', () => {
      template.hasResourceProperties('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: Match.arrayWith([
          Match.objectLike({
            Name: 'datadog-agent',
            Image: Match.stringLikeRegexp('datadog/agent'),
            Environment: Match.arrayWith([
              {
                Name: 'DD_SITE',
                Value: 'datadoghq.com',
              },
              {
                Name: 'DD_APM_ENABLED',
                Value: 'true',
              },
              {
                Name: 'DD_APM_NON_LOCAL_TRAFFIC',
                Value: 'true',
              },
            ]),
          }),
        ]),
      });
    });

    it('should configure app container with Datadog environment variables', () => {
      template.hasResourceProperties('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: Match.arrayWith([
          Match.objectLike({
            Name: 'app',
            Environment: Match.arrayWith([
              {
                Name: 'DD_SERVICE',
                Value: 'test-datadog-crud-api',
              },
              {
                Name: 'DD_ENV',
                Value: 'test',
              },
              {
                Name: 'DD_AGENT_HOST',
                Value: 'localhost',
              },
            ]),
          }),
        ]),
      });
    });
  });

  describe('Application Load Balancer', () => {
    it('should create an ALB', () => {
      template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
    });

    it('should be internet-facing', () => {
      template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
        Scheme: 'internet-facing',
        Type: 'application',
      });
    });

    it('should create a target group', () => {
      template.resourceCountIs('AWS::ElasticLoadBalancingV2::TargetGroup', 1);
    });

    it('should configure target group for port 3000', () => {
      template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
        Port: 3000,
        Protocol: 'HTTP',
        TargetType: 'ip',
      });
    });

    it('should configure health check', () => {
      template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
        HealthCheckPath: '/health',
        HealthCheckIntervalSeconds: 30,
      });
    });

    it('should create a listener on port 80', () => {
      template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
        Port: 80,
        Protocol: 'HTTP',
      });
    });
  });

  describe('ECS Service', () => {
    it('should create an ECS service', () => {
      template.resourceCountIs('AWS::ECS::Service', 1);
    });

    it('should have correct desired count', () => {
      template.hasResourceProperties('AWS::ECS::Service', {
        DesiredCount: 1,
        LaunchType: 'FARGATE',
      });
    });

    it('should use private subnets', () => {
      template.hasResourceProperties('AWS::ECS::Service', {
        NetworkConfiguration: Match.objectLike({
          AwsvpcConfiguration: Match.objectLike({
            AssignPublicIp: 'DISABLED',
          }),
        }),
      });
    });
  });

  describe('Auto Scaling', () => {
    it('should create auto scaling target', () => {
      template.resourceCountIs('AWS::ApplicationAutoScaling::ScalableTarget', 1);
    });

    it('should configure min and max capacity', () => {
      template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', {
        MinCapacity: 1,
        MaxCapacity: 4,
      });
    });

    it('should create CPU scaling policy', () => {
      template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', {
        TargetTrackingScalingPolicyConfiguration: Match.objectLike({
          PredefinedMetricSpecification: {
            PredefinedMetricType: 'ECSServiceAverageCPUUtilization',
          },
          TargetValue: 70,
        }),
      });
    });

    it('should create memory scaling policy', () => {
      template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', {
        TargetTrackingScalingPolicyConfiguration: Match.objectLike({
          PredefinedMetricSpecification: {
            PredefinedMetricType: 'ECSServiceAverageMemoryUtilization',
          },
          TargetValue: 80,
        }),
      });
    });
  });

  describe('Security Groups', () => {
    it('should create security groups', () => {
      // Should create at least 2 security groups (for ALB and ECS service)
      const securityGroups = template.findResources('AWS::EC2::SecurityGroup');
      expect(Object.keys(securityGroups).length).toBeGreaterThanOrEqual(2);
    });

    it('should allow HTTP traffic to ALB from internet', () => {
      // Find security groups
      const securityGroups = template.findResources('AWS::EC2::SecurityGroup');

      // Look for ALB security group with ingress rules allowing port 80 from internet
      const hasAlbWithHttp = Object.values(securityGroups).some((sg: any) => {
        const ingressRules = sg.Properties.SecurityGroupIngress || [];
        return ingressRules.some((rule: any) => {
          return rule.CidrIp === '0.0.0.0/0' &&
                 rule.FromPort === 80 &&
                 rule.ToPort === 80 &&
                 rule.IpProtocol === 'tcp';
        });
      });

      expect(hasAlbWithHttp).toBe(true);
    });

    it('should allow traffic from ALB to ECS service', () => {
      // Find security group ingress rules for ALB to ECS
      const ingressRules = template.findResources('AWS::EC2::SecurityGroupIngress');
      const hasAlbToEcsRule = Object.values(ingressRules).some((rule: any) => {
        return rule.Properties.IpProtocol === 'tcp' &&
               rule.Properties.SourceSecurityGroupId !== undefined;
      });
      expect(hasAlbToEcsRule).toBe(true);
    });
  });

  describe('IAM Roles', () => {
    it('should create task execution role', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sts:AssumeRole',
              Principal: {
                Service: 'ecs-tasks.amazonaws.com',
              },
            }),
          ]),
        }),
      });
    });

    it('should grant read access to Datadog API key secret', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['secretsmanager:GetSecretValue']),
              Effect: 'Allow',
            }),
          ]),
        }),
      });
    });
  });

  describe('Stack Outputs', () => {
    it('should output Load Balancer URL', () => {
      const outputs = template.findOutputs('*');
      expect(Object.keys(outputs)).toContain('LoadBalancerUrl');
    });

    it('should output ECR Repository URI', () => {
      const outputs = template.findOutputs('*');
      expect(Object.keys(outputs)).toContain('EcrRepositoryUri');
    });

    it('should output Cluster Name', () => {
      const outputs = template.findOutputs('*');
      expect(Object.keys(outputs)).toContain('ClusterName');
    });

    it('should output Service Name', () => {
      const outputs = template.findOutputs('*');
      expect(Object.keys(outputs)).toContain('ServiceName');
    });
  });
});
