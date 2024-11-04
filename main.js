var languages = [
    {
        "identifier": "auto",
        "name": "自动识别"
    },
    {
        "identifier": "zh-Hans",
        "name": "简体中文"
    },
    {
        "identifier": "en",
        "name": "英语"
    }
];

function safeLog(type, message, data) {
    try {
        const logMessage = message + (data ? (" " + JSON.stringify(data)) : "");
        if (type === 'error') {
            $log.error(logMessage);
        } else {
            $log.info(logMessage);
        }
    } catch (e) {
        // 确保日志错误不会影响主流程
    }
}

function supportLanguages() {
    try {
        return languages.map(l => l.identifier);
    } catch (err) {
        safeLog('error', "supportLanguages 错误", err);
        return ["auto", "zh-Hans", "en"];
    }
}

async function createChat(apiKey, botId, text) {
    try {
        safeLog('info', "发起创建会话请求", {
            botId,
            text
        });

        const response = await $http.request({
            method: "POST",
            url: "https://api.coze.cn/v3/chat",
            header: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "X-Coze-Api-Bot": botId.trim()
            },
            body: {
                bot_id: botId.trim(),
                user_id: "bob_plugin_user",
                stream: false,
                auto_save_history: true,
                additional_messages: [{
                    role: "user",
                    content: text,
                    content_type: "text"
                }]
            }
        });

        safeLog('info', "创建会话响应", {
            statusCode: response.statusCode,
            data: response.data
        });

        if (response.data && response.data.code !== 0) {
            throw new Error(response.data.msg || "API 错误");
        }

        if (!response.data?.data?.conversation_id) {
            throw new Error("创建会话失败: 未获取到会话ID");
        }

        return response.data.data;
    } catch (error) {
        safeLog('error', "创建会话失败", {
            error: error.message,
            response: error.response
        });
        throw new Error(`创建会话失败: ${error.message}`);
    }
}

async function sleep(seconds) {
    // 使用一个简单的循环来实现延时
    const start = Date.now();
    while (Date.now() - start < seconds * 1000) {
        // 空循环等待
        await new Promise(resolve => resolve());
    }
}

async function pollChatStatus(apiKey, botId, chatId, conversationId) {
    const maxRetries = 10;

    for (let i = 0; i < maxRetries; i++) {
        safeLog('info', `第 ${i + 1} 次查询状态`, {
            chatId,
            conversationId
        });

        const response = await $http.request({
            method: "GET",
            url: `https://api.coze.cn/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${conversationId}`,
            header: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            }
        });

        safeLog('info', "状态查询响应", {
            statusCode: response.statusCode,
            data: response.data
        });

        if (response.data && response.data.code !== 0) {
            throw new Error(response.data.msg || "API 错误");
        }

        if (!response.data?.data) {
            throw new Error("状态查询失败: 响应数据无效");
        }

        const status = response.data.data.status;
        if (status === 'completed') {
            return response.data.data;
        }

        // 不使用 sleep，直接继续下一次请求
    }

    throw new Error("等待响应超时");
}

async function getChatMessages(apiKey, botId, chatId, conversationId) {
    const response = await $http.request({
        method: "GET",
        url: `https://api.coze.cn/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`,
        header: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        }
    });

    safeLog('info', "获取消息响应", {
        statusCode: response.statusCode,
        data: response.data
    });

    if (response.data && response.data.code !== 0) {
        throw new Error(response.data.msg || "API 错误");
    }

    if (!response.data?.data) {
        throw new Error("获取消息失败: 响应数据无效");
    }

    // 获取最后一条 type=answer 的助手消息
    const assistantMessages = response.data.data.filter(
        msg => msg.role === 'assistant' && msg.type === 'answer'
    );

    if (assistantMessages.length === 0) {
        throw new Error("未找到助手回复");
    }

    return assistantMessages[assistantMessages.length - 1].content;
}

async function callCozeAPI(apiKey, botId, text) {
    try {
        safeLog('info', "=== 开始请求 ===", {
            apiKey: apiKey.substring(0, 10) + "...",
            botId,
            text
        });
        
        // 1. 创建会话
        const chatData = await createChat(apiKey, botId, text);
        const conversationId = chatData.conversation_id;
        const chatId = chatData.id;
        
        safeLog('info', "会话创建成功", {
            conversationId,
            chatId
        });
        
        // 2. 轮询等待结果
        await pollChatStatus(apiKey, botId, chatId, conversationId);
        
        // 3. 获取最终结果
        const result = await getChatMessages(apiKey, botId, chatId, conversationId);
        
        safeLog('info', "获取结果成功", { result });
        return result;

    } catch (error) {
        safeLog('error', "API 调用失败", {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

function translate(query, completion) {
    try {
        if (!query || !completion) {
            throw new Error("参数无效");
        }

        safeLog('info', "开始翻译请求", {
            query: {
                text: query.text,
                from: query.from,
                to: query.to
            }
        });
        
        const apiKey = $option.apiKey;
        const botId = $option.botId;

        if (!apiKey || !apiKey.startsWith('pat_')) {
            completion({
                error: {
                    type: "config",
                    message: "API Key 格式错误，应以 'pat_' 开头",
                }
            });
            return;
        }

        if (!botId || !/^\d+$/.test(botId.trim())) {
            completion({
                error: {
                    type: "config",
                    message: "Bot ID 格式错误，应为数字",
                }
            });
            return;
        }

        safeLog('info', "配置检查通过", {
            hasApiKey: true,
            hasBotId: true
        });

        const text = query.text || "";
        if (!text.trim()) {
            completion({
                error: {
                    type: "param",
                    message: "请输入要翻译的文本",
                }
            });
            return;
        }
        
        (async () => {
            try {
                const result = await callCozeAPI(apiKey, botId, text);
                
                if (!result) {
                    throw new Error("翻译结果为空");
                }

                const response = {
                    result: {
                        from: query.from || "auto",
                        to: query.to || "auto",
                        toParagraphs: [result]
                    }
                };

                safeLog('info', "翻译完成", { response });
                completion(response);
                
            } catch (e) {
                safeLog('error', "翻译失败", {
                    error: e.message,
                    stack: e.stack
                });
                completion({
                    error: {
                        type: "api",
                        message: `请求失败: ${e.message}`
                    }
                });
            }
        })();
        
    } catch (err) {
        safeLog('error', "插件错误", {
            error: err.message,
            stack: err.stack
        });
        if (completion) {
            completion({
                error: {
                    type: "unknown",
                    message: `插件错误: ${err.message}`
                }
            });
        }
    }
}

exports.supportLanguages = supportLanguages;
exports.translate = translate;