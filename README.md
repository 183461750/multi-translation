# Bob 豆包智能体插件

这是一个 Bob 翻译插件，用于对接豆包智能体 API，将返回的 markdown 格式内容展示在 Bob 翻译结果中。

## 安装前准备

1. 获取豆包智能体的 API Key（以 'pat_' 开头）
2. 获取豆包智能体的 Bot ID（纯数字格式）

## 安装方法

### 方法一：直接安装

1. 下载插件文件 `bob-plugin-doubean.bobplugin`
2. 双击安装到 Bob 中
3. 在插件配置中填入豆包智能体的 API Key 和 Bot ID

### 方法二：手动构建安装

1. 克隆项目
2. 在项目根目录下执行打包命令：

    ```bash
    zip -r bob-plugin-doubean.bobplugin info.json main.js lang.json assets/* README.md
    ```

3. 将生成的 `bob-plugin-doubean.bobplugin` 文件拖拽到 Bob 中进行安装

## 配置说明

- API Key: 从豆包智能体平台获取的 API 密钥
- Bot ID: 从豆包智能体平台获取的 Bot ID

## 使用说明

1. 在 Bob 中选择"豆包智能体"作为服务
2. 选择或输入要翻译的文本
3. 插件会调用豆包智能体 API 并将返回的 markdown 格式内容展示在结果中

## 注意事项

- 请确保已正确配置 API Key
- 使用时需要保持网络连接正常
- 如果网络连接正常，但仍然无法正常使用，请尝试重启 Bob
