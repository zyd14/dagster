import {
  BaseTag,
  Body2,
  Box,
  Button,
  ButtonGroup,
  ButtonLink,
  Checkbox,
  Colors,
  CursorHistoryControls,
  Dialog,
  DialogBody,
  DialogFooter,
  Spinner,
  Table,
  Tag,
} from '@dagster-io/ui-components';
import React from 'react';

import {PythonErrorInfo} from '../../app/PythonErrorInfo';
import {useQueryRefreshAtInterval} from '../../app/QueryRefresh';
import {Timestamp} from '../../app/time/Timestamp';
import {InstigationTickStatus} from '../../graphql/types';
import {useQueryPersistedState} from '../../hooks/useQueryPersistedState';
import {TimeElapsed} from '../../runs/TimeElapsed';
import {useCursorPaginatedQuery} from '../../runs/useCursorPaginatedQuery';

import {ASSET_DAMEON_TICKS_QUERY} from './AssetDaemonTicksQuery';
import {
  AssetDaemonTicksQuery,
  AssetDaemonTicksQueryVariables,
  AssetDaemonTickFragment,
} from './types/AssetDaemonTicksQuery.types';

const PAGE_SIZE = 15;

export const AutomaterializationEvaluationHistoryTable = ({
  setSelectedTick,
  setTableView,
}: {
  setSelectedTick: (tick: AssetDaemonTickFragment | null) => void;
  setTableView: (view: 'evaluations' | 'runs') => void;
}) => {
  const [statuses, setStatuses] = useQueryPersistedState<Set<InstigationTickStatus>>({
    queryKey: 'statuses',
    decode: React.useCallback(({statuses}: {statuses?: string}) => {
      return new Set<InstigationTickStatus>(
        statuses
          ? JSON.parse(statuses)
          : [
              InstigationTickStatus.STARTED,
              InstigationTickStatus.SUCCESS,
              InstigationTickStatus.FAILURE,
              InstigationTickStatus.SKIPPED,
            ],
      );
    }, []),
    encode: React.useCallback((raw: Set<InstigationTickStatus>) => {
      return {statuses: JSON.stringify(Array.from(raw))};
    }, []),
  });

  const {queryResult, paginationProps} = useCursorPaginatedQuery<
    AssetDaemonTicksQuery,
    AssetDaemonTicksQueryVariables
  >({
    query: ASSET_DAMEON_TICKS_QUERY,
    variables: {
      statuses: React.useMemo(() => Array.from(statuses), [statuses]),
    },
    nextCursorForResult: (data) => {
      const ticks = data.autoMaterializeTicks;
      if (!ticks.length) {
        return undefined;
      }
      return ticks[PAGE_SIZE - 1]?.id;
    },
    getResultArray: (data) => {
      if (!data?.autoMaterializeTicks) {
        return [];
      }
      return data.autoMaterializeTicks;
    },
    pageSize: PAGE_SIZE,
  });
  // Only refresh if we're on the first page
  useQueryRefreshAtInterval(queryResult, !paginationProps.hasPrevCursor ? 10000 : 60 * 60 * 1000);

  return (
    <Box>
      <Box
        flex={{justifyContent: 'space-between', alignItems: 'center'}}
        padding={{vertical: 12, horizontal: 24}}
        margin={{top: 32}}
        border="top"
      >
        <Box flex={{direction: 'row', gap: 8, alignItems: 'center'}}>
          <ButtonGroup
            activeItems={new Set(['evaluations'])}
            buttons={[
              {id: 'evaluations', label: 'Evaluations'},
              {id: 'runs', label: 'Runs'},
            ]}
            onClick={(id: 'evaluations' | 'runs') => {
              setTableView(id);
            }}
          />
          {!queryResult.data ? <Spinner purpose="body-text" /> : null}
        </Box>
        <Box flex={{direction: 'row', gap: 12, alignItems: 'center'}}>
          <StatusCheckbox
            statuses={statuses}
            setStatuses={setStatuses}
            status={InstigationTickStatus.STARTED}
          />
          <StatusCheckbox
            statuses={statuses}
            setStatuses={setStatuses}
            status={InstigationTickStatus.SUCCESS}
          />
          <StatusCheckbox
            statuses={statuses}
            setStatuses={setStatuses}
            status={InstigationTickStatus.FAILURE}
          />
          <StatusCheckbox
            statuses={statuses}
            setStatuses={setStatuses}
            status={InstigationTickStatus.SKIPPED}
          />
        </Box>
      </Box>
      <Table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {/* Use previous data to stop page from jumping while new data loads */}
          {(queryResult.data || queryResult.previousData)?.autoMaterializeTicks.map((tick) => (
            <tr key={tick.id}>
              <td>
                <Timestamp timestamp={{unix: tick.timestamp}} />
              </td>
              <td>
                <StatusTag tick={tick} />
              </td>
              <td>
                <TimeElapsed
                  startUnix={tick.timestamp}
                  endUnix={tick.endTimestamp || Date.now() / 1000}
                />
              </td>
              <td>
                {[InstigationTickStatus.SKIPPED, InstigationTickStatus.SUCCESS].includes(
                  tick.status,
                ) ? (
                  <ButtonLink
                    onClick={() => {
                      setSelectedTick(tick);
                    }}
                  >
                    <Body2>
                      {tick.requestedAssetMaterializationCount} materializations requested
                    </Body2>
                  </ButtonLink>
                ) : (
                  ' - '
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div style={{paddingBottom: '16px'}}>
        <CursorHistoryControls {...paginationProps} />
      </div>
    </Box>
  );
};

const StatusTag = ({tick}: {tick: AssetDaemonTickFragment}) => {
  const {status, error, requestedAssetMaterializationCount} = tick;
  const count = requestedAssetMaterializationCount;
  const [showErrors, setShowErrors] = React.useState(false);
  const tag = React.useMemo(() => {
    switch (status) {
      case InstigationTickStatus.STARTED:
        return (
          <Tag intent="primary" icon="spinner">
            Evaluating
          </Tag>
        );
      case InstigationTickStatus.SKIPPED:
        return <BaseTag fillColor={Colors.Olive50} label="0 requested" />;
      case InstigationTickStatus.FAILURE:
        return (
          <Box flex={{direction: 'row', alignItems: 'center', gap: 6}}>
            <Tag intent="danger">Failure</Tag>
            {error ? (
              <ButtonLink
                onClick={() => {
                  setShowErrors(true);
                }}
              >
                View
              </ButtonLink>
            ) : null}
          </Box>
        );
      case InstigationTickStatus.SUCCESS:
        return <Tag intent="success">{count} requested</Tag>;
    }
  }, [error, count, status]);

  return (
    <>
      {tag}
      {error ? (
        <Dialog isOpen={showErrors} title="Error" style={{width: '80vw'}}>
          <DialogBody>
            <PythonErrorInfo error={error} />
          </DialogBody>
          <DialogFooter topBorder>
            <Button
              intent="primary"
              onClick={() => {
                setShowErrors(false);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </Dialog>
      ) : null}
    </>
  );
};

const StatusLabels = {
  [InstigationTickStatus.SKIPPED]: 'None requested',
  [InstigationTickStatus.STARTED]: 'Started',
  [InstigationTickStatus.FAILURE]: 'Failed',
  [InstigationTickStatus.SUCCESS]: 'Requested',
};

function StatusCheckbox({
  status,
  statuses,
  setStatuses,
}: {
  status: InstigationTickStatus;
  statuses: Set<InstigationTickStatus>;
  setStatuses: (statuses: Set<InstigationTickStatus>) => void;
}) {
  return (
    <Checkbox
      label={StatusLabels[status]}
      checked={statuses.has(status)}
      onChange={() => {
        const newStatuses = new Set(statuses);
        if (statuses.has(status)) {
          newStatuses.delete(status);
        } else {
          newStatuses.add(status);
        }
        setStatuses(newStatuses);
      }}
    />
  );
}
