#!/bin/bash

启动       nohup npm start > app.log 2>&1 &
查看日志   tail -f app.log
查看进程   ps aux | grep node
停止       kill $(lsof -t -i:3000)