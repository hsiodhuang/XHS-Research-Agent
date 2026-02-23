# “小红书深度调研”拓展程序
针对小红书原生搜索结果，1)意图匹配不精确；2)用户需要评论区自主“看对话链、判谁更有理、找可跟进的人”等问题，通过自动化抓取与大模型分析，消除逐一点击笔记才能判断内容价值的低效环节。

# 使用方法
## 准备
![api](https://github.com/hsiodhuang/XHS-Research-Agent/blob/main/%E5%A4%A7%E6%A8%A1%E5%9E%8B%E8%B0%83%E7%94%A8.png)
进去文心一言，创建一个API Key以及Secret Key  
填入wx_api.py文件的对应位置  
chrome插件 <加载已解压的扩展程序> 选择本项目  
## 运行
由于文心一言接口调用会跨域，所以需要写一个简单的后端服务做一次中转。  
python wx_api.py 运行后端服务。  
## 使用
进入小红书网页版，进行搜索  
点击搜索图标旁边的<AI>按钮，即可回答你的问题。  
![run](https://github.com/z394339702/xhs_gpt/blob/main/img/2.gif)
