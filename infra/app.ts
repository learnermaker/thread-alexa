#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ThreadAlexaStack } from "./stack.ts";

const app = new cdk.App();
new ThreadAlexaStack(app, "ThreadAlexaStack", {
  env: { region: "us-east-1" },
});
