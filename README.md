# 网页胡聊助手

这是一个Chrome浏览器扩展，允许用户根据当前网页内容向AI助手提问。

## 功能特点

- 自动提取网页主体内容
- 使用兼容OpenAI API的端点发送问题和网页内容
- 在弹出窗口或网页内显示聊天界面
- 可自定义API端点、API密钥和模型名称

## 安装方法

### 开发模式安装

1. 下载或克隆此仓库到本地
2. 打开Chrome浏览器，在地址栏输入 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"按钮
5. 选择本项目文件夹

## 使用方法

1. 安装扩展后，在任意网页点击浏览器工具栏中的扩展图标打开弹出窗口
2. 点击"设置"标签，配置您的API端点和API密钥
3. 返回"聊天"标签，输入问题并发送
4. 也可点击网页右下角的聊天按钮(💬)，直接在网页内聊天

## 配置选项

- **API 端点**: 输入兼容OpenAI API的服务端点URL
- **API 密钥**: 输入您的API访问密钥
- **模型名称**: 输入您想使用的模型名称（默认：gpt-3.5-turbo）

## 注意事项

- 需要有效的API密钥才能使用
- 内容提取算法可能对某些网页结构效果不佳
- 大型网页内容可能会导致令牌超限

## 隐私说明

此扩展只会将当前网页内容和用户问题发送到用户配置的API端点。所有数据都在用户的浏览器和API服务之间直接传输，扩展本身不会收集或存储任何数据。 