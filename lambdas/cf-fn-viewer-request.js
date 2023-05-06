// this is CloudFront Function, not a lambda@edge. See https://aws.amazon.com/blogs/aws/introducing-cloudfront-functions-run-your-code-at-the-edge-with-low-latency-at-any-scale/
// JavaScript -> ECMAScript 5.1 compliant

function handler(event) {
    // console.log(JSON.stringify(event, null, 4));

    // if request "origin" header is not available, try to use the "referer" header to compensate it
    if (!event.request.headers.origin && event.request.headers.referer) {
        // try to fix absent "origin" header that is not sent from the client. (pre-rendering browsers or scripts)
        var req = Object.assign({}, event.request);

        req.headers["origin"] = {
            "value": event.request.headers.referer.value
        }

        return req;
    }

    return event.request;
}
