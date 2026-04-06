import DataTable from "../../../../ui/components/DataTable";
import Tabs from "../../../../ui/components/Tabs";
import { SkeletonTableRows } from "../../../../ui/components/loading";
import type {
  OpenPositionWithLive,
  OpenPositionsTableColumn,
  RuntimeDataTab,
  RuntimeTabItem,
  TradeActionFilter,
  TradeFiltersState,
  TradeSideFilter,
  TradesTableColumn,
  TradeSortBy,
  TradeSortDir,
  RuntimeTradeMeta,
} from "./types";
import type { BotRuntimeTrade } from "../../../../features/bots/types/bot.type";

type RuntimeDataSectionProps = {
  runtimeDataTab: RuntimeDataTab;
  onRuntimeDataTabChange: (tab: RuntimeDataTab) => void;
  tabItems: RuntimeTabItem[];
  openRows: OpenPositionWithLive[];
  openPositionsColumns: OpenPositionsTableColumn[];
  openPositionsSortStorageKey: string;
  openPositionsColumnVisibilityKey: string;
  openPositionsPageSizeOptions: readonly number[];
  rowsPerPageLabel: string;
  previousLabel: string;
  nextLabel: string;
  noOpenPositionsLabel: string;
  openOrdersPlaceholderLabel: string;
  tradesLoading: boolean;
  loadingLabel: string;
  tradesRows: BotRuntimeTrade[];
  tradesColumns: TradesTableColumn[];
  tradeDraftFilters: TradeFiltersState;
  onTradeDraftFiltersPatch: (patch: Partial<TradeFiltersState>) => void;
  onApplyTradeFilters: () => void;
  onResetTradeFilters: () => void;
  tradeSortBy: TradeSortBy | null;
  tradeSortDir: TradeSortDir;
  onTradeSortChange: (sortBy: string | null, direction: "asc" | "desc") => void;
  advancedOptionsLabel: string;
  allLabel: string;
  openActionLabel: string;
  dcaActionLabel: string;
  closeActionLabel: string;
  filterSideLabel: string;
  filterActionLabel: string;
  filterFromLabel: string;
  filterToLabel: string;
  applyLabel: string;
  resetLabel: string;
  tradeMeta: RuntimeTradeMeta;
  tradePageSize: number;
  onTradePageChange: (page: number) => void;
  onTradePageSizeChange: (pageSize: number) => void;
  tradePageSizeOptions: readonly number[];
  tradesColumnVisibilityKey: string;
  noTradeHistoryLabel: string;
};

export default function RuntimeDataSection(props: RuntimeDataSectionProps) {
  const tabFrameClassName =
    "rounded-box border-b-[3px] border-secondary/70 bg-gradient-to-br from-primary/70 to-secondary/70 p-px";

  return (
    <section>
        <Tabs
          items={props.tabItems}
          value={props.runtimeDataTab}
          onChange={(value) => props.onRuntimeDataTabChange(value as RuntimeDataTab)}
          variant="border"
          syncWithHash
        />

      {props.runtimeDataTab === "OPEN_POSITIONS" ? (
        <section className={tabFrameClassName}>
          <div className="rounded-box bg-base-100/85">
            <DataTable
              compact
              framed={false}
              rows={props.openRows}
              columns={props.openPositionsColumns}
              getRowId={(row) => row.id}
              defaultSortKey="pnlPercent"
              defaultSortDirection="desc"
              persistSortKey={props.openPositionsSortStorageKey}
              columnVisibilityEnabled
              columnVisibilityPreferenceKey={props.openPositionsColumnVisibilityKey}
              showSearch={false}
              paginationEnabled
              pageSizeOptions={[...props.openPositionsPageSizeOptions]}
              defaultPageSize={props.openPositionsPageSizeOptions[0]}
              rowsPerPageLabel={props.rowsPerPageLabel}
              previousLabel={props.previousLabel}
              nextLabel={props.nextLabel}
              emptyText={props.noOpenPositionsLabel}
              paginationClassName="p-3"
            />
          </div>
        </section>
      ) : null}

      {props.runtimeDataTab === "OPEN_ORDERS" ? (
        <section className={tabFrameClassName}>
          <div className="rounded-box bg-base-100/85 p-3">
            <div className="rounded-box border border-dashed border-base-300/60 bg-base-100/40 px-4 py-6 text-center text-sm opacity-75">
              {props.openOrdersPlaceholderLabel}
            </div>
          </div>
        </section>
      ) : null}

      {props.runtimeDataTab === "TRADE_HISTORY" ? (
        <section className={tabFrameClassName}>
          <div className="rounded-box bg-base-100/85">
            {props.tradesLoading ? (
              <SkeletonTableRows
                title={false}
                toolbar={false}
                columns={9}
                rows={4}
                className="mb-3 border-base-300/40 bg-base-100/60 p-3"
              />
            ) : null}
            <DataTable
              compact
              framed={false}
              rows={props.tradesRows}
              columns={props.tradesColumns}
              getRowId={(row) => row.id}
              filterPlaceholder="BTCUSDT"
              query={props.tradeDraftFilters.symbol}
              onQueryChange={(value) => props.onTradeDraftFiltersPatch({ symbol: value })}
              onSearch={props.onApplyTradeFilters}
              manualFiltering
              manualSorting
              sortKey={props.tradeSortBy}
              sortDirection={props.tradeSortDir}
              onSortChange={props.onTradeSortChange}
              toolbarClassName="p-3"
              advancedToggleLabel={props.advancedOptionsLabel}
              advancedFilters={
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                  <label className="form-control gap-1">
                    <span className="label-text text-xs opacity-70">{props.filterSideLabel}</span>
                    <select
                      className="select select-bordered select-sm h-9 min-h-9"
                      value={props.tradeDraftFilters.side}
                      onChange={(event) => {
                        props.onTradeDraftFiltersPatch({ side: event.target.value as TradeSideFilter });
                      }}
                    >
                      <option value="ALL">{props.allLabel}</option>
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                  </label>
                  <label className="form-control gap-1">
                    <span className="label-text text-xs opacity-70">{props.filterActionLabel}</span>
                    <select
                      className="select select-bordered select-sm h-9 min-h-9"
                      value={props.tradeDraftFilters.action}
                      onChange={(event) => {
                        props.onTradeDraftFiltersPatch({ action: event.target.value as TradeActionFilter });
                      }}
                    >
                      <option value="ALL">{props.allLabel}</option>
                      <option value="OPEN">{props.openActionLabel}</option>
                      <option value="DCA">{props.dcaActionLabel}</option>
                      <option value="CLOSE">{props.closeActionLabel}</option>
                    </select>
                  </label>
                  <label className="form-control gap-1">
                    <span className="label-text text-xs opacity-70">{props.filterFromLabel}</span>
                    <input
                      type="datetime-local"
                      className="input input-bordered input-sm h-9 min-h-9"
                      value={props.tradeDraftFilters.from}
                      onChange={(event) => {
                        props.onTradeDraftFiltersPatch({ from: event.target.value });
                      }}
                    />
                  </label>
                  <label className="form-control gap-1">
                    <span className="label-text text-xs opacity-70">{props.filterToLabel}</span>
                    <input
                      type="datetime-local"
                      className="input input-bordered input-sm h-9 min-h-9"
                      value={props.tradeDraftFilters.to}
                      onChange={(event) => {
                        props.onTradeDraftFiltersPatch({ to: event.target.value });
                      }}
                    />
                  </label>
                  <div className="flex items-end justify-end">
                    <div className="join">
                      <button type="button" className="btn btn-primary btn-sm join-item" onClick={props.onApplyTradeFilters}>
                        {props.applyLabel}
                      </button>
                      <button type="button" className="btn btn-outline btn-sm join-item" onClick={props.onResetTradeFilters}>
                        {props.resetLabel}
                      </button>
                    </div>
                  </div>
                </div>
              }
              paginationEnabled
              manualPagination
              page={props.tradeMeta.page}
              pageSize={props.tradePageSize}
              totalRows={props.tradeMeta.total}
              totalPages={props.tradeMeta.totalPages}
              hasPrev={props.tradeMeta.hasPrev}
              hasNext={props.tradeMeta.hasNext}
              onPageChange={props.onTradePageChange}
              onPageSizeChange={props.onTradePageSizeChange}
              pageSizeOptions={[...props.tradePageSizeOptions]}
              columnVisibilityEnabled
              columnVisibilityPreferenceKey={props.tradesColumnVisibilityKey}
              rowsPerPageLabel={props.rowsPerPageLabel}
              previousLabel={props.previousLabel}
              nextLabel={props.nextLabel}
              emptyText={props.noTradeHistoryLabel}
              paginationClassName="p-3"
            />
          </div>
        </section>
      ) : null}
    </section>
  );
}
