import requests
import json

# 测试上传API
url = "http://localhost:8080/api/customer/upload"

# 创建一个简单的文本文件进行测试
files = {
    'file': ('test.txt', 'Hello World!', 'text/plain')
}

data = {
    'shopId': '20',
    'customerCode': 'test-customer-123',
    'messageType': 'file'
}

try:
    response = requests.post(url, files=files, data=data)
    print(f"状态码: {response.status_code}")
    print(f"响应头: {response.headers}")
    print(f"响应内容: {response.text}")
    
    if response.status_code == 200:
        print("上传成功!")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    else:
        print(f"上传失败: {response.status_code}")
        
except Exception as e:
    print(f"请求失败: {e}")