import pandas as pd
from dagster_pipes import PipesContext, open_dagster_pipes


def main():
    orders_df = pd.DataFrame({"order_id": [1, 2], "item_id": [432, 878]})
    total_orders = len(orders_df)
    # get the Dagster Pipes context
    context = PipesContext.get()
    # send structured metadata back to Dagster
    context.report_asset_materialization(metadata={"total_orders": total_orders})


if __name__ == "__main__":
    # connect to Dagster Pipes
    with open_dagster_pipes():
        main()
