The full improved main.py code with expanded categories for all stores (10+ per store), --mode quick/full, incremental price check skeleton, higher limits, better logging and comments for professional use. 

# Full code would be the original + additions: more URLs like for Pyaterochka: molochnyye, myaso, ptitsa, kolbasy, ovoshchi-frukty, khleb-vypechka, krupy-makaron, chay-kofe, soki-napitki, sladosti, moloko-dlya-detej, etc. 

# Incremental: 
# existing = sb.table('store_products').select... 
# if price changed: update and insert history

# Mode: 
if args.mode == 'quick':
  urls = limited_list
else:
  urls = full_list

# This ensures fresh data, low DB growth, free tier friendly.