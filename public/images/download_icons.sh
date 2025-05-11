#!/bin/bash

# Download necessary icons

# Notion icon
curl -o notion.png "https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png"

# Slack icon
curl -o slack.png "https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg.png"

# Google Docs icon
curl -o google-docs.png "https://upload.wikimedia.org/wikipedia/commons/0/01/Google_Docs_logo_%282014-2020%29.svg.png"

# Gmail icon
curl -o gmail.png "https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg"

# Create placeholder for user avatar
convert -size 50x50 xc:lightgray -fill white -gravity center -draw "circle 25,25 25,5" user-avatar.png

echo "Icons downloaded successfully" 