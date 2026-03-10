

## Fix: Keep Status inline, centered between ID and Price

**Line 322**: Change `items-start` to `items-center` so all three zones align on the same horizontal baseline. The Status block already has `self-center` which becomes redundant but harmless.

**Line 374**: Reduce price from `text-lg` to `text-base`.

**No other changes.**

