import {resolve} from "node:path";
import {Construct} from 'constructs';
import {Duration, RemovalPolicy, Stack, StackProps} from 'aws-cdk-lib';
import {
    AllowedMethods,
    CacheCookieBehavior,
    CachedMethods,
    CacheHeaderBehavior,
    CachePolicy,
    CacheQueryStringBehavior,
    Distribution,
    Function,
    FunctionCode,
    FunctionEventType,
    HttpVersion,
    OriginRequestCookieBehavior,
    OriginRequestHeaderBehavior,
    OriginRequestPolicy,
    OriginRequestQueryStringBehavior,
    SecurityPolicyProtocol,
    ViewerProtocolPolicy,
    PriceClass,
    ResponseHeadersPolicy
} from "aws-cdk-lib/aws-cloudfront";
import {HttpOrigin} from "aws-cdk-lib/aws-cloudfront-origins";
import {Certificate, CertificateValidation} from "aws-cdk-lib/aws-certificatemanager";
import {AaaaRecord, ARecord, HostedZone, RecordTarget} from "aws-cdk-lib/aws-route53";
import {AttributeType, BillingMode, Table} from "aws-cdk-lib/aws-dynamodb";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import {CloudFrontTarget} from "aws-cdk-lib/aws-route53-targets";
import {HttpLambdaIntegration} from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import {HttpApi, HttpMethod, HttpStage, ParameterMapping, MappingValue} from "@aws-cdk/aws-apigatewayv2-alpha";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";

import configuration from "../cfg/configuration";

export class ConfigurationServiceStack extends Stack {
    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        const region = props.env?.region;
        const project =  configuration.COMMON.project;
        const environmentKey =  "environment";

        const hostedZone = HostedZone.fromHostedZoneAttributes(this, `${project}-hosted-zone`, {
            hostedZoneId: configuration.HOSTING.hostedZoneID,
            zoneName: configuration.HOSTING.hostedZoneName
        });

        const certificate = new Certificate(this, `${project}-cert`, {
            domainName: configuration.HOSTING.domainName,
            validation: CertificateValidation.fromDns(hostedZone)
        });

        const table = new Table(this, `${project}-config-db`, {
            partitionKey: {
                name: environmentKey,
                type: AttributeType.STRING
            },
            billingMode: BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.RETAIN,
            tableName: `${project}-config-db`
        });

        const lambda = new NodejsFunction(this, `${project}-config-lambda`, {
            handler: "handler",
            runtime: Runtime.NODEJS_18_X,
            entry: resolve("./lambdas/lambda.ts"),
            timeout: Duration.seconds(10),
            logRetention: RetentionDays.ONE_DAY,
            memorySize: 128,
            description: "Configuration service",
            environment: {
                REGION: props.env?.region ?? "",
                CONFIG_TABLE: table.tableName,
                DEBUG: "express:*"
            }
        });

        table.grantReadData(lambda);

        const lambdaIntegration = new HttpLambdaIntegration(`${project}-integration`, lambda, {
            parameterMapping: new ParameterMapping().overwritePath(MappingValue.requestPath())
        });

        const apiGateway = new HttpApi(this, `${project}-api-gateway`, {
            apiName: `${project}-config-api`,
            createDefaultStage: false
        });

        apiGateway.addRoutes({
            integration: lambdaIntegration,
            path: "/",
            methods: [HttpMethod.GET, HttpMethod.OPTIONS]
        });

        apiGateway.addRoutes({
            integration: lambdaIntegration,
            path: "/edge",
            methods: [HttpMethod.GET, HttpMethod.OPTIONS]
        });

        apiGateway.addRoutes({
            integration: lambdaIntegration,
            path: "/by-key",
            methods: [HttpMethod.GET, HttpMethod.OPTIONS]
        });

        const stageName = "main";

        new HttpStage(this, `${project}-stage`, {
            stageName,
            httpApi: apiGateway,
            autoDeploy: true
        });

        const httpOrigin = `${apiGateway.httpApiId}.execute-api.${region}.amazonaws.com`;

        const originRequestPolicy = new OriginRequestPolicy(this, `${project}-origin-request`, {
            comment: `${project} Config API origin request policy`,
            cookieBehavior: OriginRequestCookieBehavior.none(),
            headerBehavior: OriginRequestHeaderBehavior.allowList(
                "Origin",
                "origin",
                // next headers will be forwarded to viewer response w/o affecting cache
                "CloudFront-Viewer-City",
                "CloudFront-Viewer-Country"
            ),
            queryStringBehavior: OriginRequestQueryStringBehavior.allowList(environmentKey)
        });

        const responseHeadersPolicy = new ResponseHeadersPolicy(this, `${project}-response-headers-policy`, {
            corsBehavior: {
                accessControlAllowCredentials: false,
                accessControlAllowOrigins: ["*"],
                accessControlAllowHeaders: ["*"],
                accessControlAllowMethods: ["GET", "OPTIONS"],
                accessControlMaxAge: Duration.seconds(600),
                originOverride: false
            }
        });

        const cachePolicy = new CachePolicy(this, `${project}-cache-policy`, {
            cachePolicyName: `${project}-cache-policy`,
            cookieBehavior: CacheCookieBehavior.none(),
            enableAcceptEncodingBrotli: true,
            enableAcceptEncodingGzip: true,
            queryStringBehavior: CacheQueryStringBehavior.allowList(environmentKey),
            headerBehavior: CacheHeaderBehavior.allowList("Origin", "origin"),
            minTtl: Duration.seconds(1),
            maxTtl: Duration.days(365),
            defaultTtl: Duration.hours(1)
        });

        const cf_fn_viewer_request = new Function(this, `${project}-cf-fn-viewer-request`, {
            code: FunctionCode.fromFile({
                filePath: resolve("./lambdas/cf-fn-viewer-request.js")
            }),
            comment: "Viewer request"
        });

        const cf_fn_viewer_response = new Function(this, `${project}-cf-fn-viewer-response`, {
            code: FunctionCode.fromFile({
                filePath: resolve("./lambdas/cf-fn-viewer-response.js")
            }),
            comment: "Viewer response cloudfront function for forwarding headers from viewer request event avoiding cache"
        });

        const distribution = new Distribution(this, `${project}-api-distribution`, {
            comment: `${project} configuration distribution`,
            httpVersion: HttpVersion.HTTP2,
            priceClass: PriceClass.PRICE_CLASS_ALL,
            certificate: certificate,
            enableIpv6: true,
            minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
            enableLogging: true,
            enabled: true,
            domainNames: [configuration.HOSTING.domainName],
            defaultBehavior: {
                allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                cachePolicy: cachePolicy,
                cachedMethods: CachedMethods.CACHE_GET_HEAD_OPTIONS,
                compress: true,
                viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
                originRequestPolicy: originRequestPolicy,
                responseHeadersPolicy,
                origin: new HttpOrigin(httpOrigin, {
                    originPath: stageName,
                    originShieldRegion: region
                }),
                // CloudFront Functions (not lambda@edge)
                functionAssociations: [
                    {
                        function: cf_fn_viewer_request,
                        eventType: FunctionEventType.VIEWER_REQUEST
                    },
                    {
                        function: cf_fn_viewer_response,
                        eventType: FunctionEventType.VIEWER_RESPONSE
                    }
                ]
            }
        });

        new ARecord(this, `${project}-record-a`, {
            recordName: configuration.HOSTING.domainName,
            zone: hostedZone,
            target: RecordTarget.fromAlias(new CloudFrontTarget(distribution))
        });

        new AaaaRecord(this, `${project}-record-4a`, {
            recordName: configuration.HOSTING.domainName,
            zone: hostedZone,
            target: RecordTarget.fromAlias(new CloudFrontTarget(distribution))
        });
    }
}
