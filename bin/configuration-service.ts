#!/usr/bin/env node
import 'source-map-support/register';
import {App} from 'aws-cdk-lib';

import {ConfigurationServiceStack} from '../lib/configuration-service-stack';
import configuration from "../cfg/configuration";

const app = new App();
new ConfigurationServiceStack(app, `${configuration.COMMON.project}-stack`, {
    env: {
        account: configuration.COMMON.account,
        region: configuration.COMMON.region
    }
});