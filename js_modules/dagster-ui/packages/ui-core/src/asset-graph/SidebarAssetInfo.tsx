import {gql, useQuery} from '@apollo/client';
import {Box, Colors, ConfigTypeSchema, Icon, Spinner} from '@dagster-io/ui-components';
import * as React from 'react';
import {Link} from 'react-router-dom';
import styled from 'styled-components';

import {COMMON_COLLATOR} from '../app/Util';
import {useAssetLiveData} from '../asset-data/AssetLiveDataProvider';
import {ASSET_NODE_CONFIG_FRAGMENT} from '../assets/AssetConfig';
import {AssetDefinedInMultipleReposNotice} from '../assets/AssetDefinedInMultipleReposNotice';
import {
  AssetMetadataTable,
  ASSET_NODE_OP_METADATA_FRAGMENT,
  metadataForAssetNode,
} from '../assets/AssetMetadata';
import {AssetSidebarActivitySummary} from '../assets/AssetSidebarActivitySummary';
import {DependsOnSelfBanner} from '../assets/DependsOnSelfBanner';
import {PartitionHealthSummary} from '../assets/PartitionHealthSummary';
import {UnderlyingOpsOrGraph} from '../assets/UnderlyingOpsOrGraph';
import {Version} from '../assets/Version';
import {EXECUTE_CHECKS_BUTTON_ASSET_NODE_FRAGMENT} from '../assets/asset-checks/ExecuteChecksButton';
import {assetDetailsPathForKey} from '../assets/assetDetailsPathForKey';
import {
  healthRefreshHintFromLiveData,
  usePartitionHealthData,
} from '../assets/usePartitionHealthData';
import {DagsterTypeSummary} from '../dagstertype/DagsterType';
import {DagsterTypeFragment} from '../dagstertype/types/DagsterType.types';
import {METADATA_ENTRY_FRAGMENT} from '../metadata/MetadataEntry';
import {Description} from '../pipelines/Description';
import {SidebarSection, SidebarTitle} from '../pipelines/SidebarComponents';
import {ResourceContainer, ResourceHeader} from '../pipelines/SidebarOpHelpers';
import {pluginForMetadata} from '../plugins';
import {buildRepoAddress} from '../workspace/buildRepoAddress';
import {RepoAddress} from '../workspace/types';
import {workspacePathFromAddress} from '../workspace/workspacePath';

import {displayNameForAssetKey, GraphNode, nodeDependsOnSelf, stepKeyForAsset} from './Utils';
import {SidebarAssetQuery, SidebarAssetQueryVariables} from './types/SidebarAssetInfo.types';
import {AssetNodeForGraphQueryFragment} from './types/useAssetGraphData.types';

export const SidebarAssetInfo: React.FC<{
  graphNode: GraphNode;
}> = ({graphNode}) => {
  const {assetKey, definition} = graphNode;
  const {liveData} = useAssetLiveData(assetKey);
  const partitionHealthRefreshHint = healthRefreshHintFromLiveData(liveData);
  const partitionHealthData = usePartitionHealthData(
    [assetKey],
    partitionHealthRefreshHint,
    'background',
  );
  const {data} = useQuery<SidebarAssetQuery, SidebarAssetQueryVariables>(SIDEBAR_ASSET_QUERY, {
    variables: {assetKey: {path: assetKey.path}},
  });

  const {lastMaterialization} = liveData || {};
  const asset = data?.assetNodeOrError.__typename === 'AssetNode' ? data.assetNodeOrError : null;
  if (!asset) {
    return (
      <>
        <Header assetNode={definition} repoAddress={null} />
        <Box padding={{vertical: 64}}>
          <Spinner purpose="section" />
        </Box>
      </>
    );
  }

  const repoAddress = buildRepoAddress(asset.repository.name, asset.repository.location.name);
  const {assetMetadata, assetType} = metadataForAssetNode(asset);
  const hasAssetMetadata = assetType || assetMetadata.length > 0;
  const assetConfigSchema = asset.configField?.configType;

  const OpMetadataPlugin = asset.op?.metadata && pluginForMetadata(asset.op.metadata);

  return (
    <>
      <Header assetNode={definition} repoAddress={repoAddress} />

      <AssetDefinedInMultipleReposNotice
        assetKey={assetKey}
        loadedFromRepo={repoAddress}
        padded={false}
      />

      {(asset.description || OpMetadataPlugin?.SidebarComponent || !hasAssetMetadata) && (
        <SidebarSection title="Description">
          <Box padding={{vertical: 16, horizontal: 24}}>
            <Description description={asset.description || 'No description provided'} />
          </Box>
          {asset.op && OpMetadataPlugin?.SidebarComponent && (
            <Box padding={{bottom: 16, horizontal: 24}}>
              <OpMetadataPlugin.SidebarComponent definition={asset.op} repoAddress={repoAddress} />
            </Box>
          )}
        </SidebarSection>
      )}

      <AssetSidebarActivitySummary
        asset={asset}
        assetLastMaterializedAt={lastMaterialization?.timestamp}
        isSourceAsset={definition.isSource}
        stepKey={stepKeyForAsset(definition)}
        liveData={liveData}
      />

      <div style={{borderBottom: `2px solid ${Colors.Gray300}`}} />

      {nodeDependsOnSelf(graphNode) && <DependsOnSelfBanner />}

      {asset.opVersion && (
        <SidebarSection title="Code Version">
          <Box padding={{vertical: 16, horizontal: 24}}>
            <Version>{asset.opVersion}</Version>
          </Box>
        </SidebarSection>
      )}

      {assetConfigSchema && (
        <SidebarSection title="Config">
          <Box padding={{vertical: 16, horizontal: 24}}>
            <ConfigTypeSchema
              type={assetConfigSchema}
              typesInScope={assetConfigSchema.recursiveConfigTypes}
            />
          </Box>
        </SidebarSection>
      )}

      {asset.requiredResources.length > 0 && (
        <SidebarSection title="Required resources">
          <Box padding={{vertical: 16, horizontal: 24}}>
            {[...asset.requiredResources]
              .sort((a, b) => COMMON_COLLATOR.compare(a.resourceKey, b.resourceKey))
              .map((resource) => (
                <ResourceContainer key={resource.resourceKey}>
                  <Icon name="resource" color={Colors.Gray700} />
                  {repoAddress ? (
                    <Link
                      to={workspacePathFromAddress(
                        repoAddress,
                        `/resources/${resource.resourceKey}`,
                      )}
                    >
                      <ResourceHeader>{resource.resourceKey}</ResourceHeader>
                    </Link>
                  ) : (
                    <ResourceHeader>{resource.resourceKey}</ResourceHeader>
                  )}
                </ResourceContainer>
              ))}
          </Box>
        </SidebarSection>
      )}

      {assetMetadata.length > 0 && (
        <SidebarSection title="Metadata">
          <AssetMetadataTable assetMetadata={assetMetadata} repoLocation={repoAddress?.location} />
        </SidebarSection>
      )}

      {assetType && <TypeSidebarSection assetType={assetType} />}

      {asset.partitionDefinition && !definition.isSource && (
        <SidebarSection title="Partitions">
          <Box padding={{vertical: 16, horizontal: 24}} flex={{direction: 'column', gap: 16}}>
            <p>{asset.partitionDefinition.description}</p>
            <PartitionHealthSummary assetKey={asset.assetKey} data={partitionHealthData} />
          </Box>
        </SidebarSection>
      )}
    </>
  );
};

const TypeSidebarSection: React.FC<{
  assetType: DagsterTypeFragment;
}> = ({assetType}) => {
  return (
    <SidebarSection title="Type">
      <DagsterTypeSummary type={assetType} />
    </SidebarSection>
  );
};

const Header: React.FC<{
  assetNode: AssetNodeForGraphQueryFragment;
  opName?: string;
  repoAddress?: RepoAddress | null;
}> = ({assetNode, repoAddress}) => {
  const displayName = displayNameForAssetKey(assetNode.assetKey);

  return (
    <Box flex={{gap: 4, direction: 'column'}} margin={{left: 24, right: 12, vertical: 16}}>
      <SidebarTitle
        style={{
          marginBottom: 0,
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <Box>{displayName}</Box>
      </SidebarTitle>
      <Box flex={{direction: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <AssetCatalogLink to={assetDetailsPathForKey(assetNode.assetKey)}>
          {'View in Asset Catalog '}
          <Icon name="open_in_new" color={Colors.Link} />
        </AssetCatalogLink>

        {repoAddress && (
          <UnderlyingOpsOrGraph assetNode={assetNode} repoAddress={repoAddress} minimal />
        )}
      </Box>
    </Box>
  );
};
const AssetCatalogLink = styled(Link)`
  display: flex;
  gap: 5px;
  padding: 6px;
  margin: -6px;
  align-items: center;
  white-space: nowrap;
`;

const SIDEBAR_ASSET_FRAGMENT = gql`
  fragment SidebarAssetFragment on AssetNode {
    id
    description
    metadataEntries {
      ...MetadataEntryFragment
    }
    freshnessPolicy {
      maximumLagMinutes
      cronSchedule
      cronScheduleTimezone
    }
    autoMaterializePolicy {
      policyType
      rules {
        className
        decisionType
        description
      }
    }
    partitionDefinition {
      description
    }
    assetKey {
      path
    }
    op {
      name
      description
      metadata {
        key
        value
      }
    }
    opVersion
    jobNames
    repository {
      id
      name
      location {
        id
        name
      }
    }
    requiredResources {
      resourceKey
    }

    ...AssetNodeConfigFragment
    ...AssetNodeOpMetadataFragment
    ...ExecuteChecksButtonAssetNodeFragment
  }

  ${ASSET_NODE_CONFIG_FRAGMENT}
  ${METADATA_ENTRY_FRAGMENT}
  ${ASSET_NODE_OP_METADATA_FRAGMENT}
  ${EXECUTE_CHECKS_BUTTON_ASSET_NODE_FRAGMENT}
`;

export const SIDEBAR_ASSET_QUERY = gql`
  query SidebarAssetQuery($assetKey: AssetKeyInput!) {
    assetNodeOrError(assetKey: $assetKey) {
      ... on AssetNode {
        id
        ...SidebarAssetFragment
      }
    }
  }

  ${SIDEBAR_ASSET_FRAGMENT}
`;
