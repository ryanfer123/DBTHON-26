import json
from types import SimpleNamespace

from app.lambda_handler import handle


def test_function_url_preserves_api_routes_and_private_failure():
    event = {
        "version": "2.0",
        "routeKey": "$default",
        "rawPath": "/api/v1/health/live",
        "rawQueryString": "",
        "headers": {"host": "synthetic.lambda-url.ap-south-1.on.aws", "x-forwarded-proto": "https"},
        "requestContext": {
            "accountId": "anonymous",
            "apiId": "synthetic",
            "domainName": "synthetic.lambda-url.ap-south-1.on.aws",
            "domainPrefix": "synthetic",
            "requestId": "test",
            "routeKey": "$default",
            "stage": "$default",
            "time": "test",
            "timeEpoch": 0,
            "http": {
                "method": "GET",
                "path": "/api/v1/health/live",
                "protocol": "HTTP/1.1",
                "sourceIp": "127.0.0.1",
                "userAgent": "test",
            },
        },
        "isBase64Encoded": False,
    }
    result = handle(event, SimpleNamespace())
    assert result["statusCode"] == 200
    assert json.loads(result["body"])["data"]["status"] == "alive"
    event["rawPath"] = "/api/v1/trust-ledger/mine/verification"
    event["requestContext"]["http"]["path"] = event["rawPath"]
    result = handle(event, SimpleNamespace())
    assert result["statusCode"] in (401, 503)
    assert "password" not in result["body"].lower()
