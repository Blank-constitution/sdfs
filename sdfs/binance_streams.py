import websocket
import json
import threading
import time
import logging

logger = logging.getLogger(__name__)

def run(symbol: str, on_trade, on_depth):
    """
    Connects to Binance WebSocket streams for trade and depth data.
    
    Args:
        symbol (str): The trading symbol (e.g., 'BTCUSDT').
        on_trade (function): Callback function for trade updates.
        on_depth (function): Callback function for order book depth updates.
    """
    symbol_lower = symbol.lower()
    trade_stream = f"wss://stream.binance.com:9443/ws/{symbol_lower}@trade"
    depth_stream = f"wss://stream.binance.com:9443/ws/{symbol_lower}@depth"

    def on_message(ws, message):
        data = json.loads(message)
        stream = data.get('s', '').lower()
        event_type = data.get('e')

        if event_type == 'trade':
            on_trade(data)
        elif event_type == 'depthUpdate':
            on_depth(data)

    def on_error(ws, error):
        logger.error(f"WebSocket Error: {error}")

    def on_close(ws, close_status_code, close_msg):
        logger.warning("WebSocket closed. Reconnecting...")
        time.sleep(5)
        # Simple reconnection logic
        ws.run_forever()

    def on_open(ws):
        logger.info(f"WebSocket connected for {symbol}")
        # Subscribe to streams
        ws.send(json.dumps({
            "method": "SUBSCRIBE",
            "params": [
                f"{symbol_lower}@trade",
                f"{symbol_lower}@depth"
            ],
            "id": 1
        }))

    # Combine streams into one connection
    combined_stream_url = f"wss://stream.binance.com:9443/stream?streams={symbol_lower}@trade/{symbol_lower}@depth"
    
    ws = websocket.WebSocketApp(combined_stream_url,
                              on_open=on_open,
                              on_message=on_message,
                              on_error=on_error,
                              on_close=on_close)
    
    ws.run_forever()
