// this is CloudFront Function, not a lambda@edge. See https://aws.amazon.com/blogs/aws/introducing-cloudfront-functions-run-your-code-at-the-edge-with-low-latency-at-any-scale/
// JavaScript -> ECMAScript 5.1 compliant

var forwardRequestHeaders = [
    "cloudfront-viewer-country",
    "cloudfront-viewer-city"
];

function handler(event) {
    console.log(JSON.stringify(event, null, 4));

    if (event.request.method === "GET") {
        // CloudFront may return an incomplete cloudfront-viewer-* headers set
        forwardRequestHeaders.forEach(headerName => {
            if (event.request.headers[headerName]) {
                event.response.headers[headerName] = event.request.headers[headerName];
            }
        });
    }

    return event.response;
}
