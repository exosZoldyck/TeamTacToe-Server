@echo off
title TicTacToe-Server
cls
echo ~~~ TicTacToe-Server by Noel Spoljaric ~~~

echo Starting...

:main
node index.js
echo Restarting Server...
goto main