import React from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { FormattedMessage, injectIntl } from 'react-intl';
import { getContent, getQueryStringResults } from '@plone/volto/actions';
import { Pagination } from 'semantic-ui-react';
import { Icon } from '@plone/volto/components';
import config from '@plone/volto/registry';

import paginationLeftSVG from '@plone/volto/icons/left-key.svg';
import paginationRightSVG from '@plone/volto/icons/right-key.svg';

const ListingBody = ({ data, properties, intl, path, isEditMode }) => {
  const [currentPage, setCurrentPage] = React.useState(1);
  const content = useSelector((state) => state.content.data);
  const querystringResults = useSelector(
    (state) => state.querystringsearch.subrequests,
  );
  const dispatch = useDispatch();

  React.useEffect(() => {
    if (data?.query?.length > 0) {
      dispatch(
        getQueryStringResults(path, { ...data, fullobjects: 1 }, data.block),
      );
    } else if (data.template === 'imageGallery' && data?.query?.length === 0) {
      dispatch(
        getQueryStringResults(
          path,
          {
            ...data,
            fullobjects: 1,
            query: [
              {
                i: 'path',
                o: 'plone.app.querystring.operation.string.relativePath',
                v: '',
              },
            ],
          },
          data.block,
        ),
      );
    }

    /* eslint-disable react-hooks/exhaustive-deps */
  }, [data]);

  const folderItems = content?.is_folderish ? content.items : [];

  const loadingQuery =
    data?.query?.length > 0 && querystringResults?.[data.block]?.loading;

  const listingItems =
    data?.query?.length > 0 && querystringResults?.[data.block]
      ? (querystringResults &&
          querystringResults[data.block] &&
          querystringResults[data.block].items) ||
        []
      : folderItems;

  const templateConfig = config.blocks.blocksConfig.listing.templates;

  let templateName =
    data.template && !!templateConfig[data.template]
      ? data.template
      : 'default';

  const ListingBodyTemplate = templateConfig[templateName].template;

  function handleContentPaginationChange(e, { activePage }) {
    !isEditMode && window.scrollTo(0, 0);
    setCurrentPage(activePage);
    dispatch(getContent(path, null, null, activePage));
  }

  function handleQueryPaginationChange(e, { activePage }) {
    !isEditMode && window.scrollTo(0, 0);
    setCurrentPage(activePage);
    dispatch(
      getQueryStringResults(
        path,
        { ...data, fullobjects: 1 },
        data.block,
        activePage,
      ),
    );
  }
  const { settings } = config;

  return (
    <>
      {listingItems?.length > 0 ? (
        <>
          <ListingBodyTemplate
            items={listingItems}
            isEditMode={isEditMode}
            {...data}
          />
          {data?.query?.length === 0 &&
            content?.items_total > settings.defaultPageSize && (
              <div className="pagination-wrapper">
                <Pagination
                  activePage={currentPage}
                  totalPages={Math.ceil(
                    content.items_total / settings.defaultPageSize,
                  )}
                  onPageChange={handleContentPaginationChange}
                  firstItem={null}
                  lastItem={null}
                  prevItem={{
                    content: <Icon name={paginationLeftSVG} size="18px" />,
                    icon: true,
                    'aria-disabled': !content.batching.prev,
                    className: !content.batching.prev ? 'disabled' : null,
                  }}
                  nextItem={{
                    content: <Icon name={paginationRightSVG} size="18px" />,
                    icon: true,
                    'aria-disabled': !content.batching.next,
                    className: !content.batching.next ? 'disabled' : null,
                  }}
                />
              </div>
            )}
          {data?.query?.length > 0 &&
            querystringResults?.[data.block]?.total >
              (data.b_size || settings.defaultPageSize) && (
              <div className="pagination-wrapper">
                <Pagination
                  activePage={currentPage}
                  totalPages={Math.ceil(
                    querystringResults[data.block].total /
                      (data.b_size || settings.defaultPageSize),
                  )}
                  onPageChange={handleQueryPaginationChange}
                  firstItem={null}
                  lastItem={null}
                  prevItem={{
                    content: <Icon name={paginationLeftSVG} size="18px" />,
                    icon: true,
                    'aria-disabled': !querystringResults[data.block].batching
                      .prev,
                    className: !querystringResults[data.block].batching.prev
                      ? 'disabled'
                      : null,
                  }}
                  nextItem={{
                    content: <Icon name={paginationRightSVG} size="18px" />,
                    icon: true,
                    'aria-disabled': !querystringResults[data.block].batching
                      .next,
                    className: !querystringResults[data.block].batching.next
                      ? 'disabled'
                      : null,
                  }}
                />
              </div>
            )}
        </>
      ) : isEditMode ? (
        <div className="listing message">
          {data?.query?.length === 0 && (
            <FormattedMessage
              id="No items found in this container."
              defaultMessage="No items found in this container."
            />
          )}
          {!loadingQuery && data?.query?.length > 0 && (
            <FormattedMessage
              id="No results found."
              defaultMessage="No results found."
            />
          )}
        </div>
      ) : null}
    </>
  );
};

ListingBody.propTypes = {
  data: PropTypes.objectOf(PropTypes.any).isRequired,
  path: PropTypes.string.isRequired,
  isEditMode: PropTypes.bool,
};

export default injectIntl(ListingBody);
