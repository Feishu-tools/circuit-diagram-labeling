# -*- coding: utf-8 -*-
# @Time    :   2025/10/21 14:40:31
# @Author  :   lixumin
# @FileName:   ocr.py

import json
import base64
import asyncio
import re
from typing import Dict, Any, List, Tuple

from starlette.middleware import P
from PIL import Image
import io

import os

import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
from s3_upload import S3Uploader
import json

import lark_oapi as lark
from lark_oapi.api.bitable.v1 import *


def creat_table(table_name):
    # client = lark.Client.builder() \
    #     .app_id("cli_a801922b07325013") \
    #     .app_secret("saBeFOLLaEay7Z2wDgtwxfl46RYfWNEs") \
    #     .log_level(lark.LogLevel.DEBUG) \
    #     .build()
    # # https://gaotuedu.feishu.cn/base/MZB2bGKvLaJ7uvsNKsVcHy5Jnfc?table=tblsn9px800iINn5&view=vew20dLWLO
    # request: CreateAppTableViewRequest = CreateAppTableViewRequest.builder() \
    #     .app_token("MZB2bGKvLaJ7uvsNKsVcHy5Jnfc") \
    #     .table_id("tblsn9px800iINn5") \
    #     .request_body(ReqView.builder()
    #         .view_name("标注视图001")
    #         .view_type("grid")
    #         .build()) \
    #     .build()


    client = lark.Client.builder() \
        .app_id("cli_a801922b07325013") \
        .app_secret("saBeFOLLaEay7Z2wDgtwxfl46RYfWNEs") \
        .log_level(lark.LogLevel.DEBUG) \
        .build()
    # 构造请求对象
    request: CreateAppTableRequest = CreateAppTableRequest.builder() \
        .app_token("GkPBbJ5v0ad1JvslHY1cfEbTnNc") \
        .request_body(CreateAppTableRequestBody.builder()
            .table(ReqTable.builder()
                .name(table_name)
                .default_view_name("数据")
                .fields([AppTableCreateHeader.builder()
                    .field_name("任务ID")
                    .type(1)
                    .build(), 
                    AppTableCreateHeader.builder()
                    .field_name("图片类型")
                    .type(3)
                    .ui_type("SingleSelect")
                    .property(AppTableFieldProperty.builder()
                        .options([AppTableFieldPropertyOption.builder()
                            .name("纯答案")
                            .color(0)
                            .build(), 
                            AppTableFieldPropertyOption.builder()
                            .name("题目加答案")
                            .color(1)
                            .build()
                            ])
                        .build())
                    .build(),

                    AppTableCreateHeader.builder()
                    .field_name("是否过滤")
                    .type(3)
                    .ui_type("SingleSelect")
                    .property(AppTableFieldProperty.builder()
                        .options([AppTableFieldPropertyOption.builder()
                            .name("过滤")
                            .color(0)
                            .build(), 
                            AppTableFieldPropertyOption.builder()
                            .name("不过滤")
                            .color(1)
                            .build()
                            ])
                        .build())
                    .build(),

                    AppTableCreateHeader.builder()
                    .field_name("标注状态")
                    .type(3)
                    .ui_type("SingleSelect")
                    .property(AppTableFieldProperty.builder()
                        .options([AppTableFieldPropertyOption.builder()
                            .name("标注中")
                            .color(0)
                            .build(), 
                            AppTableFieldPropertyOption.builder()
                            .name("已标注")
                            .color(1)
                            .build(),
                            AppTableFieldPropertyOption.builder()
                            .name("未标注")
                            .color(2)
                            .build()
                            ])
                        .build())
                    .build(),

                    AppTableCreateHeader.builder()
                    .field_name("输入json")
                    .type(1)
                    .build(), 

                    AppTableCreateHeader.builder()
                    .field_name("输出json")
                    .type(1)
                    .build(), 

                    AppTableCreateHeader.builder()
                    .field_name("修改人")
                    .type(1004)
                    .build(), 

                    AppTableCreateHeader.builder()
                    .field_name("更新时间")
                    .type(1002)
                    .build(), 
                    ])
                .build())
            .build()) \
        .build()

    # 发起请求
    response: CreateAppTableResponse = client.bitable.v1.app_table.create(request)

    # 处理失败返回
    if not response.success():
        lark.logger.error(
            f"client.bitable.v1.app_table.create failed, code: {response.code}, msg: {response.msg}, log_id: {response.get_log_id()}, resp: \n{json.dumps(json.loads(response.raw.content), indent=4, ensure_ascii=False)}")
        return

    # 处理业务结果
    lark.logger.info(lark.JSON.marshal(response.data, indent=4))

    return response.data.table_id, response.data.default_view_id





def write_data_to_bitable(data: List[Dict[str, str]], table_name: str):
    client = lark.Client.builder() \
        .app_id("cli_a801922b07325013") \
        .app_secret("saBeFOLLaEay7Z2wDgtwxfl46RYfWNEs") \
        .log_level(lark.LogLevel.DEBUG) \
        .build()
    # 构造请求对象
    table_id, view_id = creat_table(table_name)

    # 构造请求对象
    request: BatchCreateAppTableRecordRequest = BatchCreateAppTableRecordRequest.builder() \
        .app_token("GkPBbJ5v0ad1JvslHY1cfEbTnNc") \
        .table_id(table_id) \
        .request_body(BatchCreateAppTableRecordRequestBody.builder()
            .records([AppTableRecord.builder()
                .fields(
                    record)
                .build()
                for record in data
                ])
            .build()) \
        .build()

    # 发起请求
    response: BatchCreateAppTableRecordResponse = client.bitable.v1.app_table_record.batch_create(request)

    # 处理失败返回
    if not response.success():
        lark.logger.error(
            f"client.bitable.v1.app_table_record.batch_create failed, code: {response.code}, msg: {response.msg}, log_id: {response.get_log_id()}, resp: \n{json.dumps(json.loads(response.raw.content), indent=4, ensure_ascii=False)}")
        return

    # 处理业务结果
    lark.logger.info(lark.JSON.marshal(response.data, indent=4))

def get_info():
    # s3_uploader = S3Uploader("algo-public", "feishu")
    root = "/Users/lixumin/Desktop/projects/circuit-diagram-labeling/process/images"
    image_names = sorted(os.listdir(root), key=lambda x: int(x.split(".")[0].split("_")[1]))

    idx = 1
    for image_name in image_names:
        task_id = image_name.split(".")[0]
        # image = Image.open(os.path.join(root, image_name)).convert("RGB")
        # image_bytes = io.BytesIO()
        # image.save(image_bytes, format="JPEG")
        # task_id = f"Task_{idx:06d}"
        # print(task_id)
        # image_url = asyncio.run(s3_uploader.upload(image_bytes.getvalue(), f"{task_id}.jpg"))
        input_json = {
            "task_id": task_id,
            "image_url": f"https://algo-public.s3.cn-north-1.amazonaws.com.cn/feishu/{task_id}.jpg",
            "label_info": []
        }
        task = {
                "任务ID": task_id,
                "图片类型": "",
                "是否过滤": "不过滤",
                "标注状态": "未标注",
                "输入json": json.dumps(input_json, ensure_ascii=False, indent=4),
                "输出json": ""
            }
        
        idx += 1
        yield task

def process():
    idx = 1
    table_name = f"v1-电路图标注数据表{(idx-1)//100 + 1:03d}"
    data = []
    for i in get_info():
        data.append(i)
        if (idx-1)%100 == 0 and idx != 1:
            write_data_to_bitable(data, table_name)
            table_name = f"v1-电路图标注数据表{(idx-1)//100 + 1:03d}"
            data = []
        idx += 1
    write_data_to_bitable(data, table_name)

if __name__ == '__main__':
    process()