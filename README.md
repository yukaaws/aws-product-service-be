# aws-product-service-be

Api id ibmz2gr304

BE: 
https://ibmz2gr304.execute-api.us-west-1.amazonaws.com/prod/products

https://ibmz2gr304.execute-api.us-west-1.amazonaws.com/prod/products/p1



FE:

https://ddk1o2ft55aha.cloudfront.net/


Import:

curl.exe "https://49t94oc7pb.execute-api.us-west-1.amazonaws.com/prod/import?name=products.csv"

 `[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("login:password"))` to get base64 for manual test

curl.exe -i -X OPTIONS -H "Origin: https://ddk1o2ft55aha.cloudfront.net" -H "Access-Control-Request-Method: GET" https://49t94oc7pb.execute-api.us-west-1.amazonaws.com/prod/import