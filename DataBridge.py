import threading
from dataclasses import dataclass, field
from collections import deque
from typing import Dict, Deque, Tuple, List, Optional

@dataclass
class MarketDataBridge:
    """
    Thread-safe data container bridging the high-frequency data engine
    with the deliberate ZenMaster trading logic.
    
    This class ensures safe concurrent access to market data between threads.
    """
    symbol: str
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    _current_price: float = 0.0
    _last_trade_time: int = 0
    _recent_trades: Deque = field(default_factory=lambda: deque(maxlen=100))
    _bids: Dict[str, str] = field(default_factory=dict)  # Price -> Quantity
    _asks: Dict[str, str] = field(default_factory=dict)  # Price -> Quantity
    
    @property
    def current_price(self) -> float:
        """Thread-safe getter for current price"""
        with self._lock:
            return self._current_price
    
    @current_price.setter
    def current_price(self, value: float):
        """Thread-safe setter for current price"""
        with self._lock:
            self._current_price = value
    
    @property
    def last_trade_time(self) -> int:
        """Thread-safe getter for last trade timestamp"""
        with self._lock:
            return self._last_trade_time
    
    @last_trade_time.setter
    def last_trade_time(self, value: int):
        """Thread-safe setter for last trade timestamp"""
        with self._lock:
            self._last_trade_time = value
    
    @property
    def recent_trades(self) -> List[Dict]:
        """Thread-safe getter for recent trades (returns a copy)"""
        with self._lock:
            return list(self._recent_trades)
    
    def add_trade(self, trade: Dict):
        """Thread-safe method to add a new trade and update current price"""
        with self._lock:
            self._recent_trades.append(trade)
            if trade.get('time', 0) > self._last_trade_time:
                self._current_price = float(trade.get('price', self._current_price))
                self._last_trade_time = trade.get('time', self._last_trade_time)
    
    @property
    def bids(self) -> Dict[str, str]:
        """Thread-safe getter for bid levels (returns a copy)"""
        with self._lock:
            return self._bids.copy()
    
    @property
    def asks(self) -> Dict[str, str]:
        """Thread-safe getter for ask levels (returns a copy)"""
        with self._lock:
            return self._asks.copy()
    
    def update_order_book(self, bids: Dict[str, str], asks: Dict[str, str]):
        """Thread-safe method to completely replace the order book"""
        with self._lock:
            self._bids = bids
            self._asks = asks
    
    def update_bids(self, bids: Dict[str, str]):
        """Thread-safe method to update specific bid levels"""
        with self._lock:
            for price, quantity in bids.items():
                if float(quantity) == 0:
                    # Remove price level if quantity is 0
                    self._bids.pop(price, None)
                else:
                    self._bids[price] = quantity
    
    def update_asks(self, asks: Dict[str, str]):
        """Thread-safe method to update specific ask levels"""
        with self._lock:
            for price, quantity in asks.items():
                if float(quantity) == 0:
                    # Remove price level if quantity is 0
                    self._asks.pop(price, None)
                else:
                    self._asks[price] = quantity
    
    def get_top_n_levels(self, n: int) -> Tuple[Dict[str, str], Dict[str, str]]:
        """Thread-safe method to get the top n price levels from the order book"""
        with self._lock:
            # Sort bids (descending) and asks (ascending)
            sorted_bids = dict(sorted(self._bids.items(), key=lambda x: float(x[0]), reverse=True)[:n])
            sorted_asks = dict(sorted(self._asks.items(), key=lambda x: float(x[0]))[:n])
            return sorted_bids, sorted_asks
