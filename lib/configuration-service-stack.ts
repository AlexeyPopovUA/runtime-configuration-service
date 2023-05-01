import {resolve} from "node:path";
import {Construct} from 'constructs';
import {Duration, RemovalPolicy, Stack, StackProps} from 'aws-cdk-lib';
import {
    AllowedMethods, CacheCookieBehavior, CachedMethods, CacheHeaderBehavior,
    CachePolicy, CacheQueryStringBehavior, Distribution, Function, FunctionCode, FunctionEventType,
    HttpVersion, OriginRequestCookieBehavior, OriginRequestHeaderBehavior,
    OriginRequestPolicy, OriginRequestQueryStringBehavior, SecurityPolicyProtocol, ViewerProtocolPolicy, PriceClass
} from "aws-cdk-lib/aws-cloudfront";
import {Certificate, CertificateValidation} from "aws-cdk-lib/aws-certificatemanager";
import {AaaaRecord, ARecord, HostedZone, RecordTarget} from "aws-cdk-lib/aws-route53";
import {AttributeType, BillingMode, Table} from "aws-cdk-lib/aws-dynamodb";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import {HttpOrigin} from "aws-cdk-lib/aws-cloudfront-origins";
import {CloudFrontTarget} from "aws-cdk-lib/aws-route53-targets";
import {HttpLambdaIntegration} from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import {HttpApi, HttpMethod, HttpStage} from "@aws-cdk/aws-apigatewayv2-alpha";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";

import configuration from "../cfg/configuration";

export class ConfigurationServiceStack extends Stack {
    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        const region = props.env?.region;
        const project =  configuration.COMMON.project;

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
                name: "environment",
                type: AttributeType.STRING
            },
            billingMode: BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.RETAIN,
            tableName: `${project}-config-db`
        });

        const lambda = new NodejsFunction(this, `${project}-config-lambda`, {
            handler: "handler",
            entry: resolve("./lambda/index.ts"),
            timeout: Duration.seconds(10),
            logRetention: RetentionDays.ONE_DAY,
            memorySize: 128,
            description: "Configuration service",
            environment: {
                CONFIG_TABLE: table.tableName
            }
        });

        table.grantReadData(lambda);

        const lambdaIntegration = new HttpLambdaIntegration(`${project}-integration`, lambda);

        const apiGateway = new HttpApi(this, `${project}-api-gateway`, {
            apiName: `${project}-config-api`,
            createDefaultStage: false
        });

        apiGateway.addRoutes({
            integration: lambdaIntegration,
            path: "/runtime",
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
            queryStringBehavior: OriginRequestQueryStringBehavior.none()
        });

        const cachePolicy = new CachePolicy(this, `${project}-cache-policy`, {
            cachePolicyName: `${project}-cache-policy`,
            cookieBehavior: CacheCookieBehavior.none(),
            enableAcceptEncodingBrotli: true,
            enableAcceptEncodingGzip: true,
            queryStringBehavior: CacheQueryStringBehavior.none(),
            headerBehavior: CacheHeaderBehavior.allowList("Origin", "origin"),
            minTtl: Duration.seconds(1),
            maxTtl: Duration.days(365),
            defaultTtl: Duration.hours(1)
        });

        const cf_fn_viewer_request = new Function(this, `${project}-cf-fn-viewer-request`, {
            code: FunctionCode.fromFile({
                filePath: resolve("./lambda/cf-fn-viewer-request.js")
            }),
            comment: "Viewer request"
        });

        const cf_fn_viewer_response = new Function(this, `${project}-cf-fn-viewer-response`, {
            code: FunctionCode.fromFile({
                filePath: resolve("./lambda/cf-fn-viewer-response.js")
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
