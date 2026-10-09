# Latency Results

Date: 2026-10-09 · local, Windows 11

```
tool                   n     p50 ms    p95 ms   
------------------------------------------------
list_threads           20    6         10       
get_thread             20    4         7        
report_change          5     16        23       
```

All p95 values well under the 200 ms local threshold (Alexa+ requires < 500 ms).
