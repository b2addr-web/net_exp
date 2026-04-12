import numpy as np

def calculate_trade_levels(symbol, current_price, support_level, resistance_level):
    """
    نموذج كود لحساب مستويات الدخول والأهداف لسهم معين
    Sample code to calculate entry and target levels for a stock
    """
    
    # تحديد نقطة الدخول (Entry Point)
    # عادة ما تكون قريبة من مستوى الدعم أو عند اختراق المقاومة
    entry_price = current_price
    
    # حساب الأهداف (Take Profit)
    # الهدف الأول: منتصف المسافة للمقاومة التالية
    tp1 = current_price + (resistance_level - current_price) * 0.5
    
    # الهدف الثاني: عند مستوى المقاومة
    tp2 = resistance_level
    
    # وقف الخسارة (Stop Loss)
    # عادة يكون تحت مستوى الدعم بنسبة بسيطة (مثلاً 2%)
    stop_loss = support_level * 0.98
    
    return {
        "symbol": symbol,
        "entry": round(entry_price, 2),
        "tp1": round(tp1, 2),
        "tp2": round(tp2, 2),
        "sl": round(stop_loss, 2)
    }

# مثال للاستخدام:
# سهم آبل (AAPL) بسعر 180، دعم عند 175، مقاومة عند 190
setup = calculate_trade_levels("AAPL", 180, 175, 190)
print(f"Trade Setup for {setup['symbol']}:")
print(f"Entry: {setup['entry']}")
print(f"TP1: {setup['tp1']}")
print(f"TP2: {setup['tp2']}")
print(f"Stop Loss: {setup['sl']}")
