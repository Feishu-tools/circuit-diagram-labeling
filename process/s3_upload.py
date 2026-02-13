import asyncio
from concurrent.futures import ThreadPoolExecutor
import aioboto3
import io
import os

class S3Uploader:
    """异步上传照片到s3

    Args:
        image_bytes (bytes): 图片的二进制数据
        key (str): 文件夹
        bucket (str): 存储桶

    Returns:
        str: 图片链接
    """
    def __init__(
            self,
            bucket_name: str,
            key: str) -> None:
        self.bucket_name = bucket_name
        self.key = key


    async def upload(
        self,
        image_bytes: bytes,
        file_name: str
    ) -> str:
        # time + 8 = now
        blob_s3_key = f"{self.key}/{file_name}"
        session = aioboto3.Session()
        async with session.client("s3") as s3:
            file = io.BytesIO(image_bytes)
            await s3.upload_fileobj(
                file, self.bucket_name, blob_s3_key,
                ExtraArgs={"ContentType": f"image/jpeg"}
                )
        return f"https://{self.bucket_name}.s3.cn-north-1.amazonaws.com.cn/{blob_s3_key}"

def upload_file(s3uploader, file_path):
    with open(file_path, "rb") as f:
        url = asyncio.run(s3uploader.upload(f.read(), f"circuit-diagram-labeling-{os.path.basename(file_path)}"))
        print(url)
        return url


def rename_image():
    image_folder = "/Users/lixumin/Desktop/projects/circuit-diagram-labeling/process/images"
    file_paths = [os.path.join(image_folder, i) for i in sorted(os.listdir(image_folder), key=lambda x: int(x.split(".")[0]))]
    idx = 1
    for file_path in file_paths:
        task_id = f"Task_{idx:06d}"
        os.rename(file_path, os.path.join(image_folder, f"{task_id}.jpg"))
        idx += 1

if __name__ == "__main__":
    # rename_image()
    s3uploader = S3Uploader("algo-public", "feishu")
    
    image_folder = "/Users/lixumin/Desktop/projects/circuit-diagram-labeling/process/images"
    file_paths = [os.path.join(image_folder, i) for i in sorted(os.listdir(image_folder), key=lambda x: x.split(".")[0])]

    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = [executor.submit(upload_file, s3uploader, file_path) for file_path in file_paths]
        for future in futures:
            future.result()
