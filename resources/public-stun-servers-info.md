# Public STUN Servers

List aggregated from https://gist.github.com/mondain/b0ec1cf5f60ae726202e?permalink_comment_id=3238034#gistcomment-3238034

Most recent check for dead links:
2024-03-09

To check which of these links are dead, use this script:
```
cat resources/public-stun-servers.txt | tr : ' ' | xargs -n1 -l echo "nc -uz" | bash 2>&1 >/dev/null | awk '{print $6}'
```

