#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatadogAppStack } from '../lib/datadog-app-stack';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext('environment') || 'dev';
const datadogApiKey = app.node.tryGetContext('datadogApiKey');
const datadogSite = app.node.tryGetContext('datadogSite') || 'datadoghq.com';

// Deployment region and account from environment variables or use defaults
const region = process.env.CDK_DEFAULT_REGION || 'ap-southeast-1';
const account = process.env.CDK_DEFAULT_ACCOUNT;

new DatadogAppStack(app, `DatadogAppStack-${environment}`, {
  environment,
  datadogApiKey,
  datadogSite,
  desiredCount: 1,
  cpu: 256,
  memory: 512,
  env: {
    account,
    region,
  },
  description: `Datadog learning application infrastructure for ${environment} environment`,
  tags: {
    Environment: environment,
    Application: 'test-datadog-crud-api',
    ManagedBy: 'CDK',
  },
});
