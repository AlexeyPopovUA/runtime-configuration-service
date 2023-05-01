export const handler = async (...args: any[]) => {
    console.log("handler");
    console.log(JSON.stringify(args, null, 4));

    const response = {
        statusCode: 200,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({testResponce: 123}),
    };
    console.log("response options");
    console.log(JSON.stringify(response));
    return response;
}
