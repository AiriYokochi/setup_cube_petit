#!/bin/bash

flag=0

if [ $# -ne 1 ]; then
  echo "指定された引数は$#個です。" 1>&2
  echo "実行するには1個の引数が必要です。" 1>&2
  exit 1
fi

prss=$1

while :
do
  pidMEM=(`ps -ef | grep "${prss}" | grep -v grep | awk '{ print $2; }'`)
  if [ -n "${pidMEM}" ]; then
    kill -9 ${pidMEM}
    echo "kill pid:"${pidMEM}
    flag=1
  else
    if [ $flag = 0 ]; then
      echo "no process :"${prss}
    fi
    break
  fi
done