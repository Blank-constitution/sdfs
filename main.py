import threading
import time
import logging
import sys
from DataBridge import MarketDataBridge
from ZenMaster import ZenMaster
from flask import Flask, request, jsonify

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("digital_monk.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("Main")

# Import the sdfs engine's run function
# Note: You'll need to adjust this import to match your actual sdfs module structure
try:
    from sdfs.binance_streams import run as sdfs_run
except ImportError:
    # Fallback import paths
    try:
        from sdfs import run as sdfs_run
    except ImportError:
        logger.error("Failed to import 'run' function from sdfs. Please check the module path.")
        raise

def sdfs_wrapper(data_bridge):
    """
    Wrapper function for the sdfs engine that processes incoming WebSocket data
    and updates the shared data bridge.
    
    Args:
        data_bridge: The shared MarketDataBridge object
    """
    def on_trade_update(trade_data):
        """Callback for trade updates from the WebSocket"""
        # Process and add the trade to our data bridge
        processed_trade = {
            'price': trade_data.get('p'),  # Price
            'quantity': trade_data.get('q'),  # Quantity
            'time': trade_data.get('T'),  # Trade time
            'is_buyer_maker': trade_data.get('m'),  # Is buyer maker flag
            'trade_id': trade_data.get('t')  # Trade ID
        }
        data_bridge.add_trade(processed_trade)
        
        # Update current price
        data_bridge.current_price = float(processed_trade['price'])
    
    def on_depth_update(depth_data):
        """Callback for order book updates from the WebSocket"""
        # Process bid and ask updates
        bids = {item[0]: item[1] for item in depth_data.get('b', [])}  # Price -> Quantity
        asks = {item[0]: item[1] for item in depth_data.get('a', [])}  # Price -> Quantity
        
        # Update our data bridge
        if bids:
            data_bridge.update_bids(bids)
        if asks:
            data_bridge.update_asks(asks)
    
    # Call the sdfs run function with our callbacks
    sdfs_run(
        symbol=data_bridge.symbol,
        on_trade=on_trade_update,
        on_depth=on_depth_update
    )

def create_command_server(bot_instance):
    """Creates a Flask server to receive commands from the Node.js backend."""
    app = Flask(__name__)
    
    @app.route('/command', methods=['POST'])
    def handle_command():
        data = request.json
        logger.info(f"[Command Server] Received command: {data}")
        
        command_type = data.get('type', 'ZEN_MASTER')
        
        # --- How it Functions: ---
        # This endpoint acts as the brain's "ear," listening for external commands.
        # A command from TradingView (via the Node.js server) can bypass the ZenMaster's
        # normal patient meditation and force an immediate action. This is perfect for
        # strategies defined externally in Pine Script.
        
        if command_type == 'ZEN_MASTER':
            action = data.get('action')
            if action == 'BUY':
                bot_instance.enter_trade(bot_instance.data_bridge.current_price)
                return jsonify({"status": "BUY command executed for ZenMaster"}), 200
            elif action == 'SELL':
                bot_instance.exit_trade(bot_instance.data_bridge.current_price)
                return jsonify({"status": "SELL command executed for ZenMaster"}), 200
        
        elif command_type == 'ARBITRAGE_SCAN':
            # Future enhancement: This could trigger a high-priority scan
            # in an arbitrage module.
            logger.info("[Command Server] Arbitrage scan trigger received (feature placeholder).")
            return jsonify({"status": "Arbitrage scan triggered"}), 200
            
        return jsonify({"error": "Invalid command type or action"}), 400

    return app

def main():
    """
    Main function that orchestrates the Digital Monk trading system.
    It initializes the data bridge, starts the data engine in a background thread,
    and runs the ZenMaster in the main thread.
    """
    # Configuration
    symbol = "BTCUSDT"
    update_interval = 0.1  # 100ms between ZenMaster meditations
    
    logger.info("Initializing Digital Monk Trading System")
    logger.info(f"Trading symbol: {symbol}")
    
    # Create the shared data bridge
    data_bridge = MarketDataBridge(symbol)
    logger.info("Market data bridge initialized")
    
    # Create and start the data engine thread
    logger.info("Starting data engine thread...")
    data_thread = threading.Thread(
        target=sdfs_wrapper,
        args=(data_bridge,),
        daemon=True  # Thread will terminate when main program exits
    )
    data_thread.start()
    logger.info("Data engine thread started")
    
    # Allow some time for initial data population
    time.sleep(2)
    logger.info("Waiting for market data...")
    
    # Ensure we have some initial data before proceeding
    wait_cycles = 0
    while data_bridge.current_price == 0 and wait_cycles < 30:
        time.sleep(1)
        wait_cycles += 1
        
    if data_bridge.current_price == 0:
        logger.warning("No market data received after 30 seconds. Check connections.")
    else:
        logger.info(f"Initial market data received. Current price: {data_bridge.current_price}")
    
    # Create the Zen Master
    zen_master = ZenMaster(data_bridge, symbol)
    logger.info("ZenMaster initialized and ready for meditation")

    # Create and start the command server thread
    command_app = create_command_server(zen_master)
    command_thread = threading.Thread(
        target=lambda: command_app.run(host='0.0.0.0', port=5056),
        daemon=True
    )
    command_thread.start()
    logger.info("Command server started on port 5056")
    
    # Main loop
    try:
        logger.info("Starting main trading loop")
        while True:
            # Let the Zen Master meditate on the current market state
            zen_master.meditate()
            
            # Sleep for the update interval
            time.sleep(update_interval)
    except KeyboardInterrupt:
        logger.info("Gracefully shutting down on keyboard interrupt")
    except Exception as e:
        logger.error(f"Unexpected error in main loop: {str(e)}", exc_info=True)
    finally:
        logger.info("Digital Monk trading system shutting down")

if __name__ == "__main__":
    main()
