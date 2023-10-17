import {gql} from '@apollo/client';
import {Box, Colors, FontFamily, Icon, Spinner, Tooltip} from '@dagster-io/ui-components';
import countBy from 'lodash/countBy';
import isEqual from 'lodash/isEqual';
import React from 'react';
import {Link} from 'react-router-dom';
import styled, {CSSObject} from 'styled-components';

import {withMiddleTruncation} from '../app/Util';
import {useAssetLiveData} from '../asset-data/AssetLiveDataProvider';
import {PartitionCountTags} from '../assets/AssetNodePartitionCounts';
import {StaleReasonsTags} from '../assets/Stale';
import {assetDetailsPathForKey} from '../assets/assetDetailsPathForKey';
import {AssetComputeKindTag} from '../graph/OpTags';
import {AssetCheckExecutionResolvedStatus, AssetCheckSeverity} from '../graphql/types';
import {markdownToPlaintext} from '../ui/markdownToPlaintext';

import {buildAssetNodeStatusContent} from './AssetNodeStatusContent';
import {AssetLatestRunSpinner} from './AssetRunLinking';
import {LiveDataForNode} from './Utils';
import {ASSET_NODE_NAME_MAX_LENGTH} from './layout';
import {AssetNodeFragment} from './types/AssetNode.types';

export const AssetNode: React.FC<{
  definition: AssetNodeFragment;
  selected: boolean;
}> = React.memo(({definition, selected}) => {
  const displayName = definition.assetKey.path[definition.assetKey.path.length - 1]!;
  const isSource = definition.isSource;

  const {liveData} = useAssetLiveData(definition.assetKey);
  return (
    <AssetInsetForHoverEffect>
      <AssetTopTags definition={definition} liveData={liveData} />
      <AssetNodeContainer $selected={selected}>
        <AssetNodeBox $selected={selected} $isSource={isSource}>
          <Name $isSource={isSource}>
            <span style={{marginTop: 1}}>
              <Icon name={isSource ? 'source_asset' : 'asset'} />
            </span>
            <div
              data-tooltip={displayName}
              data-tooltip-style={isSource ? NameTooltipStyleSource : NameTooltipStyle}
              style={{overflow: 'hidden', textOverflow: 'ellipsis'}}
            >
              {withMiddleTruncation(displayName, {
                maxLength: ASSET_NODE_NAME_MAX_LENGTH,
              })}
            </div>
            <div style={{flex: 1}} />
          </Name>
          <Box style={{padding: '6px 8px'}} flex={{direction: 'column', gap: 4}} border="top">
            {definition.description ? (
              <Description $color={Colors.Gray800}>
                {markdownToPlaintext(definition.description).split('\n')[0]}
              </Description>
            ) : (
              <Description $color={Colors.Gray400}>No description</Description>
            )}
            {definition.isPartitioned && !definition.isSource && (
              <PartitionCountTags definition={definition} liveData={liveData} />
            )}
            <StaleReasonsTags liveData={liveData} assetKey={definition.assetKey} include="self" />
          </Box>

          {isSource && !definition.isObservable ? null : (
            <AssetNodeStatusRow definition={definition} liveData={liveData} />
          )}
          {(liveData?.assetChecks || []).length > 0 && (
            <AssetNodeChecksRow definition={definition} liveData={liveData} />
          )}
          <AssetComputeKindTag definition={definition} style={{right: -2, paddingTop: 7}} />
        </AssetNodeBox>
      </AssetNodeContainer>
    </AssetInsetForHoverEffect>
  );
}, isEqual);

const AssetTopTags: React.FC<{
  definition: AssetNodeFragment;
  liveData?: LiveDataForNode;
}> = ({definition, liveData}) => (
  <Box flex={{gap: 4}} padding={{left: 4}} style={{height: 24}}>
    <StaleReasonsTags liveData={liveData} assetKey={definition.assetKey} include="upstream" />
  </Box>
);

const AssetNodeRowBox = styled(Box)`
  white-space: nowrap;
  line-height: 12px;
  font-size: 12px;
  height: 24px;
  a:hover {
    text-decoration: none;
  }
  &:last-child {
    border-bottom-left-radius: 6px;
    border-bottom-right-radius: 6px;
  }
`;

interface StatusRowProps {
  definition: AssetNodeFragment;
  liveData: LiveDataForNode | undefined;
}

const AssetNodeStatusRow: React.FC<StatusRowProps> = ({definition, liveData}) => {
  const {content, background} = buildAssetNodeStatusContent({
    assetKey: definition.assetKey,
    definition,
    liveData,
  });
  return (
    <AssetNodeRowBox
      background={background}
      padding={{horizontal: 8}}
      flex={{justifyContent: 'space-between', alignItems: 'center', gap: 6}}
    >
      {content}
    </AssetNodeRowBox>
  );
};

type AssetCheckIconType =
  | Exclude<
      AssetCheckExecutionResolvedStatus,
      AssetCheckExecutionResolvedStatus.FAILED | AssetCheckExecutionResolvedStatus.EXECUTION_FAILED
    >
  | 'NOT_EVALUATED'
  | 'WARN'
  | 'ERROR';

const AssetCheckIconsOrdered: {type: AssetCheckIconType; content: React.ReactNode}[] = [
  {
    type: AssetCheckExecutionResolvedStatus.IN_PROGRESS,
    content: <Spinner purpose="caption-text" />,
  },
  {
    type: 'NOT_EVALUATED',
    content: <Icon name="dot" color={Colors.Gray500} />,
  },
  {
    type: 'ERROR',
    content: <Icon name="cancel" color={Colors.Red700} />,
  },
  {
    type: 'WARN',
    content: <Icon name="warning_outline" color={Colors.Yellow700} />,
  },
  {
    type: AssetCheckExecutionResolvedStatus.SKIPPED,
    content: <Icon name="dot" color={Colors.Gray500} />,
  },
  {
    type: AssetCheckExecutionResolvedStatus.SUCCEEDED,
    content: <Icon name="check_circle" color={Colors.Green700} />,
  },
];

const AssetNodeChecksRow: React.FC<{
  definition: AssetNodeFragment;
  liveData: LiveDataForNode | undefined;
}> = ({definition, liveData}) => {
  if (!liveData || !liveData.assetChecks.length) {
    return <span />;
  }

  const byIconType = countBy(liveData.assetChecks, (c) => {
    const status = c.executionForLatestMaterialization?.status;
    const value: AssetCheckIconType =
      status === undefined
        ? 'NOT_EVALUATED'
        : status === AssetCheckExecutionResolvedStatus.FAILED
        ? c.executionForLatestMaterialization?.evaluation?.severity === AssetCheckSeverity.WARN
          ? 'WARN'
          : 'ERROR'
        : status === AssetCheckExecutionResolvedStatus.EXECUTION_FAILED
        ? 'ERROR'
        : status;
    return value;
  });

  return (
    <AssetNodeRowBox
      padding={{horizontal: 8}}
      flex={{justifyContent: 'space-between', alignItems: 'center', gap: 6}}
      border="top"
      background={Colors.Gray50}
    >
      Checks
      <Link
        to={assetDetailsPathForKey(definition.assetKey, {view: 'checks'})}
        onClick={(e) => e.stopPropagation()}
      >
        <Box flex={{gap: 6, alignItems: 'center'}}>
          {AssetCheckIconsOrdered.filter((a) => byIconType[a.type]).map((icon) => (
            <Box flex={{gap: 2, alignItems: 'center'}} key={icon.type}>
              {icon.content}
              {byIconType[icon.type]}
            </Box>
          ))}
        </Box>
      </Link>
    </AssetNodeRowBox>
  );
};

export const AssetNodeMinimal: React.FC<{
  selected: boolean;
  definition: AssetNodeFragment;
}> = ({selected, definition}) => {
  const {isSource, assetKey} = definition;
  const {liveData} = useAssetLiveData(assetKey);
  const {border, background} = buildAssetNodeStatusContent({assetKey, definition, liveData});
  const displayName = assetKey.path[assetKey.path.length - 1]!;

  return (
    <AssetInsetForHoverEffect>
      <MinimalAssetNodeContainer $selected={selected}>
        <TooltipStyled
          content={displayName}
          canShow={displayName.length > 14}
          targetTagName="div"
          position="top"
        >
          <MinimalAssetNodeBox
            $selected={selected}
            $isSource={isSource}
            $background={background}
            $border={border}
          >
            <div
              style={{
                top: '50%',
                position: 'absolute',
                transform: 'translate(8px, -16px)',
              }}
            >
              <AssetLatestRunSpinner liveData={liveData} purpose="section" />
            </div>
            <MinimalName style={{fontSize: 30}} $isSource={isSource}>
              {withMiddleTruncation(displayName, {maxLength: 14})}
            </MinimalName>
          </MinimalAssetNodeBox>
        </TooltipStyled>
      </MinimalAssetNodeContainer>
    </AssetInsetForHoverEffect>
  );
};

// Note: This fragment should only contain fields that are needed for
// useAssetGraphData and the Asset DAG. Some pages of Dagster UI request this
// fragment for every AssetNode on the instance. Add fields with care!
//
export const ASSET_NODE_FRAGMENT = gql`
  fragment AssetNodeFragment on AssetNode {
    id
    graphName
    hasMaterializePermission
    jobNames
    opNames
    opVersion
    description
    computeKind
    isPartitioned
    isObservable
    isSource
    assetKey {
      ...AssetNodeKey
    }
  }

  fragment AssetNodeKey on AssetKey {
    path
  }
`;

const AssetInsetForHoverEffect = styled.div`
  padding: 10px 4px 2px 4px;
  height: 100%;

  & *:focus {
    outline: 0;
  }
`;

const AssetNodeContainer = styled.div<{$selected: boolean}>`
  user-select: none;
  cursor: pointer;
  padding: 4px;
`;

const AssetNodeShowOnHover = styled.span`
  display: none;
`;

const AssetNodeBox = styled.div<{$isSource: boolean; $selected: boolean}>`
  ${(p) =>
    p.$isSource
      ? `border: 2px dashed ${p.$selected ? Colors.Gray600 : Colors.Gray300}`
      : `border: 2px solid ${p.$selected ? Colors.Blue500 : Colors.Blue200}`};

  ${(p) =>
    p.$isSource
      ? `outline: 3px solid ${p.$selected ? Colors.Gray300 : 'transparent'}`
      : `outline: 3px solid ${p.$selected ? Colors.Blue200 : 'transparent'}`};

  background: ${Colors.White};
  border-radius: 8px;
  position: relative;
  &:hover {
    box-shadow: rgba(0, 0, 0, 0.12) 0px 2px 12px 0px;
    ${AssetNodeShowOnHover} {
      display: initial;
    }
  }
`;

/** Keep in sync with DISPLAY_NAME_PX_PER_CHAR */
const NameCSS: CSSObject = {
  padding: '3px 6px',
  color: Colors.Gray800,
  fontFamily: FontFamily.monospace,
  fontWeight: 600,
};

const NameTooltipCSS: CSSObject = {
  ...NameCSS,
  top: -9,
  left: -12,
  fontSize: 16.8,
};

export const NameTooltipStyle = JSON.stringify({
  ...NameTooltipCSS,
  background: Colors.Blue50,
  border: `1px solid ${Colors.Blue100}`,
});

const NameTooltipStyleSource = JSON.stringify({
  ...NameTooltipCSS,
  background: Colors.Gray100,
  border: `1px solid ${Colors.Gray200}`,
});

const Name = styled.div<{$isSource: boolean}>`
  ${NameCSS};
  display: flex;
  gap: 4px;
  background: ${(p) => (p.$isSource ? Colors.Gray100 : Colors.Blue50)};
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
`;

const MinimalAssetNodeContainer = styled(AssetNodeContainer)`
  padding-top: 30px;
  padding-bottom: 42px;
  height: 100%;
`;

const MinimalAssetNodeBox = styled.div<{
  $isSource: boolean;
  $selected: boolean;
  $background: string;
  $border: string;
}>`
  background: ${(p) => p.$background};
  ${(p) =>
    p.$isSource
      ? `border: 4px dashed ${p.$selected ? Colors.Gray500 : p.$border}`
      : `border: 4px solid ${p.$selected ? Colors.Blue500 : p.$border}`};

  ${(p) =>
    p.$isSource
      ? `outline: 8px solid ${p.$selected ? Colors.Gray300 : 'transparent'}`
      : `outline: 8px solid ${p.$selected ? Colors.Blue200 : 'transparent'}`};

  border-radius: 10px;
  position: relative;
  padding: 4px;
  height: 100%;
  min-height: 46px;
  &:hover {
    box-shadow: rgba(0, 0, 0, 0.12) 0px 2px 12px 0px;
  }
`;

const MinimalName = styled(Name)`
  font-weight: 600;
  white-space: nowrap;
  position: absolute;
  background: none;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

const Description = styled.div<{$color: string}>`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${(p) => p.$color};
  font-size: 12px;
`;

const TooltipStyled = styled(Tooltip)`
  height: 100%;
`;
