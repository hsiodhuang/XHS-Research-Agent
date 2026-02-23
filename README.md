# “小红书深度调研”浏览器拓展
介绍：针对小红书原生搜索结果，1)意图匹配不精确；2)用户需要评论区自主“看对话链、判谁更有理、找可跟进的人”等问题，通过自动化抓取与大模型分析，消除逐一点击笔记才能判断内容价值的低效环节。  

# 使用方法
需要提前准备好大模型的API Key、Base URL和Model ID，没有可以参考步骤1，准备好了进行步骤2。

## 1.准备大模型
使用中转站API，后续统一通过OpenAI兼容接口调用，更换模型更方便。  
下图展示的是火山引擎中转站，需要付费、开通、创建、使用自己需要的大模型，并复制页面展示的API Key.

![api](https://github.com/hsiodhuang/XHS-Research-Agent/blob/main/%E5%A4%A7%E6%A8%A1%E5%9E%8B%E8%B0%83%E7%94%A8.png)

还有另外两个参数config.BaseURL和Model，在下面这个网页里复制（不加引号）。

![api](https://github.com/hsiodhuang/XHS-Research-Agent/blob/main/%E5%A4%A7%E6%A8%A1%E5%9E%8B%E4%BF%A1%E6%81%AF.png)

## 2.填入大模型信息
将开通申请好的API Key、Base URL和Model ID填入.env文件即模型信息。  

## 3.修改浏览器设置
使用谷歌浏览器，网址栏输入chrome://extensions/  
右上角选中开发者模式，左上角点击“加载未打包的拓展程序”，选中项目文件夹。最终设置结果如下图所示：

![api](https://github.com/hsiodhuang/XHS-Research-Agent/blob/main/%E8%AE%BE%E7%BD%AE%E6%B5%8F%E8%A7%88%E5%99%A8.png)

## 4.运行py代码
此时已经可以发现，在小红书网页端搜索结果页面，右下角多出了“生成深度调研报告”按钮，如下图。没出现可以刷新页面试试。  
但在点击这个按钮之前，需要提前运行项目里的app.py程序，不然会报错，不过报错也不要紧，重新运行程序、再刷新网页即可。 

![api](https://github.com/hsiodhuang/XHS-Research-Agent/blob/main/%E5%B0%8F%E7%BA%A2%E4%B9%A6%E6%90%9C%E7%B4%A2%E7%BB%93%E6%9E%9C.png) 

## 4.使用拓展程序
小红书首页搜索栏将你需要踩中的关键词同步输入，并以空格隔开。  
在搜索结果页面点击“生成深度调研报告”按钮，程序自动读取关键词并抓取笔记文本，包括标题、正文、评论及回复，数据发送至本地Flask服务。  
生成以下内容：  
1)聚焦关键词的单篇摘要，用于快速判断单篇笔记价值，如果帖子没有踩中关键词将会返回不相关提示；  
2)用户可以自主勾选单篇，生成多篇汇总，内容包括核心结论、共识与分歧、避坑点，附原帖链接，并结合活跃度与信息密度给出可私信用户建议。

## 5.效果图示
单篇摘要
![api](https://github.com/hsiodhuang/XHS-Research-Agent/blob/main/%E7%94%9F%E6%88%90%E5%8D%95%E7%AF%87%E6%91%98%E8%A6%81.png)

汇总报告
![api](https://github.com/hsiodhuang/XHS-Research-Agent/blob/main/%E7%94%9F%E6%88%90%E6%9C%80%E7%BB%88%E6%8A%A5%E5%91%8A.png)
