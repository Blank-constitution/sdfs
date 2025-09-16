from statistics import mean, median
from typing import Dict, List, Tuple
from DataBridge import MarketDataBridge

class OrderBookManager:
    """
    The Order Book Manager represents one of the monk's senses.
    It analyzes the market's depth (order book) to find structural patterns.
    
    These patterns include liquidity walls (strong support/resistance),
    imbalances, and vacuums that can indicate potential price direction.
    """
    def __init__(self, data_bridge: MarketDataBridge):
        self.data_bridge = data_bridge
    
    def finds_strong_support(self, threshold_multiplier: float = 20.0) -> bool:
        """
        Detects a "Liquidity Wall" - an abnormally large order at a single price level
        that can act as strong support.
        
        Args:
            threshold_multiplier: Order size must be this many times larger than average
                                 to qualify as a liquidity wall (default: 20x)
                                 
        Returns:
            True if a strong support level is detected
        """
        # Get top 10 bid levels
        top_bids, _ = self.data_bridge.get_top_n_levels(10)
        
        if len(top_bids) < 3:  # Need enough levels for meaningful analysis
            return False
            
        # Calculate average bid quantity
        bid_quantities = [float(qty) for qty in top_bids.values()]
        avg_quantity = mean(bid_quantities)
        
        # Check for any level with quantity exceeding the threshold
        for quantity in bid_quantities:
            if quantity > threshold_multiplier * avg_quantity:
                return True
                
        return False
    
    def detects_ask_liquidity_vacuum(self, threshold_ratio: float = 0.2) -> bool:
        """
        Detects a "Liquidity Vacuum" - an absence of sell orders above current price,
        which can allow for rapid upward price movement.
        
        Args:
            threshold_ratio: Ratio defining how sparse ask liquidity must be
                           relative to bid liquidity (default: 0.2 = 20%)
                           
        Returns:
            True if an ask liquidity vacuum is detected
        """
        top_bids, top_asks = self.data_bridge.get_top_n_levels(5)
        
        if not top_bids or not top_asks:
            return False
            
        total_bid_quantity = sum(float(qty) for qty in top_bids.values())
        total_ask_quantity = sum(float(qty) for qty in top_asks.values())
        
        # Check if ask liquidity is significantly less than bid liquidity
        return total_ask_quantity < threshold_ratio * total_bid_quantity
    
    def calculates_bid_ask_imbalance(self) -> float:
        """
        Calculates the normalized imbalance between buying and selling pressure.
        
        Returns:
            A value between -1.0 and 1.0, where:
            - Positive values indicate buyer dominance (buying pressure)
            - Negative values indicate seller dominance (selling pressure)
            - Values near 0 indicate balance
        """
        top_bids, top_asks = self.data_bridge.get_top_n_levels(10)
        
        if not top_bids or not top_asks:
            return 0.0
            
        total_bid_quantity = sum(float(qty) for qty in top_bids.values())
        total_ask_quantity = sum(float(qty) for qty in top_asks.values())
        total_quantity = total_bid_quantity + total_ask_quantity
        
        if total_quantity == 0:
            return 0.0
            
        # Calculate normalized imbalance between -1.0 and 1.0
        return (total_bid_quantity - total_ask_quantity) / total_quantity
    
    def finds_price_cluster(self) -> Tuple[bool, float]:
        """
        Identifies price levels where orders are clustered, indicating
        a potential support or resistance zone.
        
        Returns:
            (detected, price_level) tuple where:
            - detected: True if a significant price cluster is found
            - price_level: The price at which orders are clustered
        """
        bids, asks = self.data_bridge.get_top_n_levels(20)
        
        # Combine all price levels for analysis
        all_levels = {}
        all_levels.update(bids)
        all_levels.update(asks)
        
        if len(all_levels) < 5:  # Need enough levels
            return False, 0.0
            
        # Find the price level with the maximum quantity
        max_qty_price = max(all_levels.items(), key=lambda x: float(x[1]))[0]
        max_qty = float(all_levels[max_qty_price])
        
        # Calculate the average quantity across all levels
        avg_qty = mean(float(qty) for qty in all_levels.values())
        
        # A price cluster exists if the maximum quantity is at least 5x the average
        is_cluster = max_qty > 5 * avg_qty
        
        return is_cluster, float(max_qty_price)
