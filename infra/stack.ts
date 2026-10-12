// CDK stack: Lambda Function URL + DynamoDB + SSM + CloudWatch + Budget.
// npm run synth must pass offline with zero AWS credentials.
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as iam from "aws-cdk-lib/aws-iam";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";
import { join } from "node:path";

export class ThreadAlexaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repoRoot = join(import.meta.dirname, "..");

    // --- Parameters ---
    const budgetEmail = new cdk.CfnParameter(this, "BudgetEmail", {
      type: "String",
      description: "Email for the $5/month budget alert",
      default: "you@example.com",
    });

    const oauthJwk = new cdk.CfnParameter(this, "OAuthJwk", {
      type: "String",
      description: "OAuth ES256 private JWK as JSON string",
      default: "{}",
      noEcho: true,
    });

    const oauthClientSecret = new cdk.CfnParameter(this, "OAuthClientSecret", {
      type: "String",
      description: "OAuth client secret for alexa-sim",
      default: "change-me",
      noEcho: true,
    });

    // --- DynamoDB ---
    const table = new dynamodb.Table(this, "ThreadState", {
      tableName: "thread-state",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 5,
      writeCapacity: 5,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // --- SSM Parameters ---
    const ssmJwk = new ssm.StringParameter(this, "SsmOAuthJwk", {
      parameterName: "/thread/oauth-jwk",
      stringValue: oauthJwk.valueAsString,
      tier: ssm.ParameterTier.STANDARD,
    });

    const ssmSecret = new ssm.StringParameter(this, "SsmOAuthClientSecret", {
      parameterName: "/thread/oauth-client-secret",
      stringValue: oauthClientSecret.valueAsString,
      tier: ssm.ParameterTier.STANDARD,
    });

    // --- Lambda ---
    const fn = new NodejsFunction(this, "Handler", {
      entry: join(repoRoot, "server", "lambda.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: table.tableName,
        OAUTH_JWK_JSON: ssmJwk.stringValue,
        OAUTH_CLIENT_SECRET: ssmSecret.stringValue,
        DEMO_MODE: "true",
        LIVE_AGENT: "",
        LIVE_AGENT_DAILY_CAP: "50",
      },
      bundling: {
        externalModules: ["@aws-sdk/*"],
        format: OutputFormat.ESM,
        mainFields: ["module", "main"],
        target: "node24",
        loader: { ".json": "json" },
      },
    });

    // Function URL (auth NONE — the Hono app handles OAuth)
    const fnUrl = fn.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });

    // Grant permissions
    table.grantReadWriteData(fn);
    ssmJwk.grantRead(fn);
    ssmSecret.grantRead(fn);

    // Bedrock (conditional on LIVE_AGENT, granted broadly so it works when enabled)
    fn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      resources: ["*"],
    }));

    // --- CloudWatch Logs ---
    new logs.LogGroup(this, "HandlerLogs", {
      logGroupName: `/aws/lambda/${fn.functionName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // --- Budget ---
    new cdk.CfnResource(this, "MonthlyBudget", {
      type: "AWS::Budgets::Budget",
      properties: {
        Budget: {
          BudgetName: "thread-alexa-monthly",
          BudgetType: "COST",
          TimeUnit: "MONTHLY",
          BudgetLimit: { Amount: 5, Unit: "USD" },
        },
        NotificationsWithSubscribers: [{
          Notification: {
            NotificationType: "ACTUAL",
            ComparisonOperator: "GREATER_THAN",
            Threshold: 80,
          },
          Subscribers: [{ SubscriptionType: "EMAIL", Address: budgetEmail.valueAsString }],
        }],
      },
    });

    // --- Outputs ---
    new cdk.CfnOutput(this, "FunctionUrl", { value: fnUrl.url, description: "THREAD MCP server URL" });
    new cdk.CfnOutput(this, "TableName", { value: table.tableName });
  }
}
