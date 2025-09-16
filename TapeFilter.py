from statistics import mean, median
from typing import Dict, List
from DataBridge import MarketDataBridge

class TapeFilter:
    """
    The Tape Filter represents one of the monk's senses.
    It analyzes the market's time & sales (the "tape") to detect
    anomalous trading patterns and momentum shifts.
    
    The tape shows every individual transaction that occurs in the market.
    """
    def __init__(self, data_bridge: MarketDataBridge):
        self.data_bridge = data_bridge
    
    def detects_ignition_spike(self, threshold_multiplier: float = 15.0) -> bool:
        """
        Detects an "Ignition Spike" - an abnormally large trade that can
        indicate the start of a significant price movement.
        
        Args:
            threshold_multiplier: How many times larger than average a trade 
                                 must be to qualify (default: 15x)
                                 
        Returns:
            True if an ignition spike is detected
        """
        recent_trades = self.data_bridge.recent_trades
        
        if len(recent_trades) < 10:  # Need enough trades for meaningful analysis
            return False
            
        # Extract volumes from recent trades
        volumes = [float(trade.get('quantity', 0)) for trade in recent_trades]
        
        # Calculate average volume (excluding the largest to avoid skew)
        sorted_volumes = sorted(volumes)
        avg_volume = mean(sorted_volumes[:-1]) if len(sorted_volumes) > 1 else sorted_volumes[0]
        
        # Check if any recent trade exceeds the threshold
        for trade in recent_trades[-5:]:  # Focus on most recent trades
            trade_volume = float(trade.get('quantity', 0))
            if trade_volume > threshold_multiplier * avg_volume:
                return True
                
        return False
    
    def detects_buyer_dominance(self, window_size: int = 20) -> bool:
        """
        Determines if buyers are dominating the recent trades (aggressive buying).
        
        Args:
            window_size: Number of recent trades to analyze
            
        Returns:
            True if buyers are dominant (>70% of volume is buy side)
        """
        recent_trades = self.data_bridge.recent_trades[-window_size:]
        
        if len(recent_trades) < window_size * 0.5:  # Need enough trades
            return False
            
        # Sum up buy volume (trades where the buyer was the aggressor)
        # Note: is_buyer_maker=False means the buyer was the aggressor (taker)
        buy_volume = sum(float(trade.get('quantity', 0)) for trade in recent_trades 
                       if trade.get('is_buyer_maker', False) is False)
        
        # Sum up total volume
        total_volume = sum(float(trade.get('quantity', 0)) for trade in recent_trades)
        
        # Consider buyers dominant if they represent more than 70% of volume
        return (buy_volume / total_volume) > 0.7 if total_volume > 0 else False
    
    def is_accelerating_volume(self, periods: int = 3) -> bool:
        """
        Checks if trading volume is accelerating over recent periods,
        which can indicate increasing market interest.
        
        Args:
            periods: Number of periods to check for acceleration
            
        Returns:
            True if volume is consistently increasing across periods
        """
        recent_trades = self.data_bridge.recent_trades
        
        if len(recent_trades) < 10 * periods:  # Need enough data
            return False
            
        # Split trades into periods and calculate volume per period
        trades_per_period = len(recent_trades) // periods
        period_volumes = []
        
        for i in range(periods):
            start_idx = i * trades_per_period
            end_idx = (i + 1) * trades_per_period if i < periods - 1 else len(recent_trades)
            period_trades = recent_trades[start_idx:end_idx]
            period_volume = sum(float(trade.get('quantity', 0)) for trade in period_trades)
            period_volumes.append(period_volume)
            
        # Check if volumes are consistently increasing
        return all(period_volumes[i] < period_volumes[i+1] for i in range(periods-1))
    
    def detects_large_trade_sequence(self, min_sequence: int = 3, threshold: float = 10.0) -> bool:
        """
        Detects a sequence of consecutive large trades in the same direction,
        which can indicate strong institutional buying or selling.
        
        Args:
            min_sequence: Minimum number of consecutive large trades required
            threshold: How many times larger than median a trade must be
            
        Returns:
            True if a sequence of large trades is detected
        """
        recent_trades = self.data_bridge.recent_trades
        
        if len(recent_trades) < 10:  # Need enough trades
            return False
            
        # Calculate median trade size (more robust than mean)
        median_size = median(float(trade.get('quantity', 0)) for trade in recent_trades)
        
        # Look for consecutive large trades
        sequence_count = 0
        last_direction = None
        
        for trade in recent_trades[-10:]:  # Check most recent 10 trades
            size = float(trade.get('quantity', 0))
            is_buyer = trade.get('is_buyer_maker', False) is False
            
            # Is this a large trade?
            if size > threshold * median_size:
                # Check if same direction as previous large trade
                if last_direction is None or last_direction == is_buyer:
                    sequence_count += 1
                    last_direction = is_buyer
                else:
                    # Direction changed, reset sequence
                    sequence_count = 1
                    last_direction = is_buyer
            else:
                # Not a large trade, reset sequence
                sequence_count = 0
                
            # Have we found our sequence?
            if sequence_count >= min_sequence:
                return True
                
        return False
