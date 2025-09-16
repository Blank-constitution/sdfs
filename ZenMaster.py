from enum import Enum
import time
import logging
from DataBridge import MarketDataBridge
from OrderBookManager import OrderBookManager
from TapeFilter import TapeFilter

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ZenMaster")

class BotState(Enum):
    WATCHING_IN_NIRVANA = "watching_in_nirvana"
    WAITING_FOR_ENTRY = "waiting_for_entry"
    IN_TRADE = "in_trade"
    EXITING_TRADE = "exiting_trade"

class ZenMaster:
    def __init__(self, data_bridge: MarketDataBridge, symbol: str, initial_capital: float = 1000.0):
        self.data_bridge = data_bridge
        self.symbol = symbol
        self.capital = initial_capital
        self.state = BotState.WATCHING_IN_NIRVANA
        self.book = OrderBookManager(data_bridge)
        self.tape = TapeFilter(data_bridge)
        self.entry_price = 0.0
        self.position_size = 0.0
        self.entry_time = 0
        self.trades_executed = 0
        self.profitable_trades = 0
        self.total_profit_loss = 0.0
        logger.info(f"ZenMaster initialized for {symbol} with {initial_capital} capital")
        logger.info("Entering state of peaceful observation. Watching for The Nail...")

    def meditate(self):
        current_price = self.data_bridge.current_price
        if current_price == 0:
            return

        if self.state == BotState.WATCHING_IN_NIRVANA:
            if self.look_for_the_nail():
                logger.info("⚡ THE NAIL HAS BEEN FOUND! Perfect alignment detected.")
                self.state = BotState.WAITING_FOR_ENTRY
                logger.info("Transitioning to WAITING_FOR_ENTRY state.")
        elif self.state == BotState.WAITING_FOR_ENTRY:
            if self.should_enter_now(current_price):
                self.enter_trade(current_price)
        elif self.state == BotState.IN_TRADE:
            if self.should_exit_trade(current_price):
                self.state = BotState.EXITING_TRADE
                logger.info("Exit conditions met. Transitioning to EXITING_TRADE state.")
        elif self.state == BotState.EXITING_TRADE:
            self.exit_trade(current_price)

    def look_for_the_nail(self) -> bool:
        strong_support = self.book.finds_strong_support()
        ignition_spike = self.tape.detects_ignition_spike()
        buyer_dominance = self.tape.detects_buyer_dominance()
        liquidity_vacuum = self.book.detects_ask_liquidity_vacuum()
        
        all_conditions_met = all([strong_support, ignition_spike, buyer_dominance, liquidity_vacuum])
        
        if all_conditions_met:
            logger.info("✓ Strong support detected ✓ Ignition spike detected ✓ Buyer dominance confirmed ✓ Ask liquidity vacuum present")
        
        return all_conditions_met

    def should_enter_now(self, current_price: float) -> bool:
        imbalance = self.book.calculates_bid_ask_imbalance()
        accelerating_volume = self.tape.is_accelerating_volume()
        large_trade_sequence = self.tape.detects_large_trade_sequence()
        
        is_entry_time = (imbalance > 0.7 and accelerating_volume and large_trade_sequence)
        
        if is_entry_time:
            logger.info(f"Entry conditions confirmed: Imbalance: {imbalance:.2f}, Accelerating Volume: {accelerating_volume}, Large Trade Sequence: {large_trade_sequence}")
        
        return is_entry_time

    def enter_trade(self, entry_price: float):
        risk_amount = self.capital * 0.02
        self.position_size = risk_amount / entry_price
        self.entry_price = entry_price
        self.entry_time = int(time.time() * 1000)
        self.state = BotState.IN_TRADE
        logger.info(f"ENTERING TRADE at {entry_price:.2f}, Size: {self.position_size:.6f}, Risk: ${risk_amount:.2f}")

    def should_exit_trade(self, current_price: float) -> bool:
        pnl_percentage = ((current_price - self.entry_price) / self.entry_price) * 100
        if pnl_percentage >= 6.0:
            logger.info(f"Target reached! PnL: {pnl_percentage:.2f}%")
            return True
        if pnl_percentage <= -2.0:
            logger.info(f"Stop loss hit. PnL: {pnl_percentage:.2f}%")
            return True
        bid_ask_imbalance = self.book.calculates_bid_ask_imbalance()
        if bid_ask_imbalance < -0.5:
            logger.info(f"Exiting due to developing selling pressure. Imbalance: {bid_ask_imbalance:.2f}")
            return True
        return False

    def exit_trade(self, exit_price: float):
        pnl_percentage = ((exit_price - self.entry_price) / self.entry_price) * 100
        pnl_amount = self.position_size * (exit_price - self.entry_price)
        
        self.trades_executed += 1
        self.total_profit_loss += pnl_amount
        if pnl_amount > 0:
            self.profitable_trades += 1
        
        self.capital += pnl_amount
        
        logger.info(f"EXITED TRADE at {exit_price:.2f}, PnL: {pnl_percentage:.2f}% (${pnl_amount:.2f}), New Capital: ${self.capital:.2f}")
        
        win_rate = (self.profitable_trades / self.trades_executed) * 100 if self.trades_executed > 0 else 0
        logger.info(f"Win rate: {win_rate:.1f}% ({self.profitable_trades}/{self.trades_executed})")
        
        self.entry_price = 0.0
        self.position_size = 0.0
        self.entry_time = 0
        self.state = BotState.WATCHING_IN_NIRVANA
        logger.info("Returning to state of watchful meditation...")
            ignition_spike, 
            buyer_dominance, 
            liquidity_vacuum
        ])
        
        if all_conditions_met:
            logger.info("✓ Strong support detected in order book")
            logger.info("✓ Ignition spike detected in tape")
            logger.info("✓ Buyer dominance confirmed")
            logger.info("✓ Ask liquidity vacuum present")
        
        return all_conditions_met
    
    def should_enter_now(self, current_price: float) -> bool:
        """
        Once "The Nail" is found, this method determines the
        precise moment for entry based on additional confirmation signals.
        
        Args:
            current_price: Current market price
            
        Returns:
            True if this is the optimal entry moment
        """
        # Check bid-ask imbalance for strong buying pressure
        imbalance = self.book.calculates_bid_ask_imbalance()
        
        # Check if volume is accelerating
        accelerating_volume = self.tape.is_accelerating_volume()
        
        # Check for sequence of large trades in same direction
        large_trade_sequence = self.tape.detects_large_trade_sequence()
        
        # We want strong buying pressure and accelerating volume
        is_entry_time = (imbalance > 0.7 and 
                         accelerating_volume and 
                         large_trade_sequence)
        
        if is_entry_time:
            logger.info(f"Entry conditions confirmed:")
            logger.info(f"  - Bid/Ask imbalance: {imbalance:.2f}")
            logger.info(f"  - Accelerating volume: {accelerating_volume}")
            logger.info(f"  - Large trade sequence: {large_trade_sequence}")
        
        return is_entry_time
    
    def enter_trade(self, entry_price: float):
        """
        Execute the trade entry with disciplined position sizing.
        
        Args:
            entry_price: Price at which to enter the trade
        """
        # Calculate position size (2% risk per trade)
        risk_amount = self.capital * 0.02
        self.position_size = risk_amount / entry_price
        self.entry_price = entry_price
        self.entry_time = int(time.time() * 1000)  # Current time in milliseconds
        
        self.state = BotState.IN_TRADE
        
        logger.info(f"ENTERING TRADE at {entry_price:.2f}")
        logger.info(f"Position size: {self.position_size:.6f}")
        logger.info(f"Risk amount: ${risk_amount:.2f} (2% of capital)")
    
    def should_exit_trade(self, current_price: float) -> bool:
        """
        Determines if we should exit the current trade based on
        profit targets, stop loss, or changing market conditions.
        
        Args:
            current_price: Current market price
            
        Returns:
            True if exit conditions are met
        """
        # Calculate current profit/loss
        pnl_percentage = ((current_price - self.entry_price) / self.entry_price) * 100
        
        # Exit if we've reached our profit target (3:1 reward-to-risk ratio)
        if pnl_percentage >= 6.0:  # 3 times our 2% risk
            logger.info(f"Target reached! PnL: {pnl_percentage:.2f}%")
            return True
            
        # Exit if we've hit our stop loss
        if pnl_percentage <= -2.0:  # Our 2% risk
            logger.info(f"Stop loss hit. PnL: {pnl_percentage:.2f}%")
            return True
            
        # Check for reversal signals in the tape and order book
        bid_ask_imbalance = self.book.calculates_bid_ask_imbalance()
        
        # If we see strong selling pressure developing, exit the trade
        if bid_ask_imbalance < -0.5:
            logger.info(f"Exiting due to developing selling pressure. Imbalance: {bid_ask_imbalance:.2f}")
            return True
            
        # Otherwise, hold the position
        return False
    
    def exit_trade(self, exit_price: float):
        """
        Execute the trade exit and update performance metrics.
        
        Args:
            exit_price: Price at which to exit the trade
        """
        # Calculate profit/loss
        pnl_percentage = ((exit_price - self.entry_price) / self.entry_price) * 100
        pnl_amount = self.position_size * (exit_price - self.entry_price)
        
        # Update performance metrics
        self.trades_executed += 1
        self.total_profit_loss += pnl_amount
        if pnl_amount > 0:
            self.profitable_trades += 1
        
        # Update capital
        self.capital += pnl_amount
        
        # Log the trade result
        logger.info(f"EXITED TRADE at {exit_price:.2f}")
        logger.info(f"PnL: {pnl_percentage:.2f}% (${pnl_amount:.2f})")
        logger.info(f"Updated capital: ${self.capital:.2f}")
        
        win_rate = (self.profitable_trades / self.trades_executed) * 100 if self.trades_executed > 0 else 0
        logger.info(f"Win rate: {win_rate:.1f}% ({self.profitable_trades}/{self.trades_executed})")
        
        # Reset trade tracking
        self.entry_price = 0.0
        self.position_size = 0.0
        self.entry_time = 0
        
        # Return to watching state
        self.state = BotState.WATCHING_IN_NIRVANA
        logger.info("Returning to state of watchful meditation...")
