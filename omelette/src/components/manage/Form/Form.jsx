/**
 * Form component.
 * @module components/manage/Form/Form
 */

import { EditBlock, Field, Icon, Toast } from '@plone/volto/components';
import {
  blockHasValue,
  difference,
  FormValidation,
  getBlocksFieldname,
  getBlocksLayoutFieldname,
  messages,
} from '@plone/volto/helpers';
import aheadSVG from '@plone/volto/icons/ahead.svg';
import clearSVG from '@plone/volto/icons/clear.svg';
import dragSVG from '@plone/volto/icons/drag.svg';
import {
  findIndex,
  isEmpty,
  keys,
  map,
  mapValues,
  omit,
  pickBy,
  without,
  cloneDeep,
} from 'lodash';
import move from 'lodash-move';
import isBoolean from 'lodash/isBoolean';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import { injectIntl } from 'react-intl';
import { Portal } from 'react-portal';
import {
  Button,
  Container,
  Form as UiForm,
  Message,
  Segment,
  Tab,
} from 'semantic-ui-react';
import { v4 as uuid } from 'uuid';
import { toast } from 'react-toastify';
import { BlocksToolbar } from '@plone/volto/components';
import config from '@plone/volto/registry';

/**
 * Form container class.
 * @class Form
 * @extends Component
 */
class Form extends Component {
  /**
   * Property types.
   * @property {Object} propTypes Property types.
   * @static
   */
  static propTypes = {
    schema: PropTypes.shape({
      fieldsets: PropTypes.arrayOf(
        PropTypes.shape({
          fields: PropTypes.arrayOf(PropTypes.string),
          id: PropTypes.string,
          title: PropTypes.string,
        }),
      ),
      properties: PropTypes.objectOf(PropTypes.any),
      definitions: PropTypes.objectOf(PropTypes.any),
      required: PropTypes.arrayOf(PropTypes.string),
    }),
    formData: PropTypes.objectOf(PropTypes.any),
    pathname: PropTypes.string,
    onSubmit: PropTypes.func,
    onCancel: PropTypes.func,
    submitLabel: PropTypes.string,
    resetAfterSubmit: PropTypes.bool,
    isEditForm: PropTypes.bool,
    isAdminForm: PropTypes.bool,
    title: PropTypes.string,
    error: PropTypes.shape({
      message: PropTypes.string,
    }),
    loading: PropTypes.bool,
    hideActions: PropTypes.bool,
    description: PropTypes.string,
    visual: PropTypes.bool,
    blocks: PropTypes.arrayOf(PropTypes.object),
    onChangeFormData: PropTypes.func,
    requestError: PropTypes.string,
    allowedBlocks: PropTypes.arrayOf(PropTypes.string),
    showRestricted: PropTypes.bool,
  };

  /**
   * Default properties.
   * @property {Object} defaultProps Default properties.
   * @static
   */
  static defaultProps = {
    formData: null,
    onSubmit: null,
    onCancel: null,
    submitLabel: null,
    resetAfterSubmit: false,
    isEditForm: false,
    isAdminForm: false,
    title: null,
    description: null,
    error: null,
    loading: null,
    hideActions: false,
    visual: false,
    blocks: [],
    pathname: '',
    schema: {},
    requestError: null,
    allowedBlocks: null,
  };

  /**
   * Constructor
   * @method constructor
   * @param {Object} props Component properties
   * @constructs Form
   */
  constructor(props) {
    super(props);
    const ids = {
      title: uuid(),
      text: uuid(),
    };
    let { formData } = props;
    const blocksFieldname = getBlocksFieldname(formData);
    const blocksLayoutFieldname = getBlocksLayoutFieldname(formData);

    if (!props.isEditForm) {
      // It's a normal (add form), get defaults from schema
      formData = {
        ...mapValues(props.schema.properties, 'default'),
        ...formData,
      };
    }
    // defaults for block editor; should be moved to schema on server side
    // Adding fallback in case the fields are empty, so we are sure that the edit form
    // shows at least the default blocks
    if (
      formData.hasOwnProperty(blocksFieldname) &&
      formData.hasOwnProperty(blocksLayoutFieldname)
    ) {
      if (
        !formData[blocksLayoutFieldname] ||
        isEmpty(formData[blocksLayoutFieldname].items)
      ) {
        formData[blocksLayoutFieldname] = {
          items: [ids.title, ids.text],
        };
      }
      if (!formData[blocksFieldname] || isEmpty(formData[blocksFieldname])) {
        formData[blocksFieldname] = {
          [ids.title]: {
            '@type': 'title',
          },
          [ids.text]: {
            '@type': config.settings.defaultBlockType,
          },
        };
      }
    }
    this.state = {
      formData,
      initialFormData: cloneDeep(formData),
      errors: {},
      selected:
        formData.hasOwnProperty(blocksLayoutFieldname) &&
        formData[blocksLayoutFieldname].items.length > 0
          ? formData[blocksLayoutFieldname].items[0]
          : null,
      multiSelected: [],
      placeholderProps: {},
      isClient: false,
    };
    this.onChangeField = this.onChangeField.bind(this);
    this.onChangeBlock = this.onChangeBlock.bind(this);
    this.onMutateBlock = this.onMutateBlock.bind(this);
    this.onSelectBlock = this.onSelectBlock.bind(this);
    this.onDeleteBlock = this.onDeleteBlock.bind(this);
    this.onAddBlock = this.onAddBlock.bind(this);
    this.onMoveBlock = this.onMoveBlock.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.onFocusPreviousBlock = this.onFocusPreviousBlock.bind(this);
    this.onFocusNextBlock = this.onFocusNextBlock.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.onTabChange = this.onTabChange.bind(this);
    this.onBlurField = this.onBlurField.bind(this);
    this.onClickInput = this.onClickInput.bind(this);
  }

  /**
   * On updates caused by props change
   * if errors from Backend come, these will be shown to their corresponding Fields
   * also the first Tab to have any errors will be selected
   * @param {Object} prevProps
   */
  async componentDidUpdate(prevProps, prevState) {
    let { requestError } = this.props;
    let errors = {};
    let activeIndex = 0;

    if (requestError && prevProps.requestError !== requestError) {
      errors = FormValidation.giveServerErrorsToCorrespondingFields(
        requestError,
      );
      activeIndex = FormValidation.showFirstTabWithErrors({
        errors,
        schema: this.props.schema,
      });

      this.setState({
        errors,
        activeIndex,
      });
    }

    if (this.props.onChangeFormData) {
      if (
        JSON.stringify(prevState?.formData) !==
        JSON.stringify(this.state.formData)
      ) {
        this.props.onChangeFormData(this.state.formData);
      }
    }
  }

  /**
   * Tab selection is done only by setting activeIndex in state
   */
  onTabChange(e, { activeIndex }) {
    this.setState({ activeIndex });
  }

  /**
   * If user clicks on input, the form will be not considered pristine
   * this will avoid onBlur effects without interraction with the form
   * @param {Object} e event
   */
  onClickInput(e) {
    this.setState({ isFormPristine: false });
  }

  /**
   * Validate fields on blur
   * @method onBlurField
   * @param {string} id Id of the field
   * @param {*} value Value of the field
   * @returns {undefined}
   */
  onBlurField(id, value) {
    if (!this.state.isFormPristine) {
      const errors = FormValidation.validateFieldsPerFieldset({
        schema: this.props.schema,
        formData: this.state.formData,
        formatMessage: this.props.intl.formatMessage,
      });

      this.setState({
        errors,
      });
    }
  }

  /**
   * Component did mount
   * @method componentDidMount
   * @returns {undefined}
   */
  componentDidMount() {
    this.setState({ isClient: true });
  }

  /**
   * Change field handler
   * Remove errors for changed field
   * @method onChangeField
   * @param {string} id Id of the field
   * @param {*} value Value of the field
   * @returns {undefined}
   */
  onChangeField(id, value) {
    this.setState((prevState) => {
      const { errors, formData } = prevState;
      delete errors[id];
      return {
        errors,
        formData: {
          ...formData,
          // We need to catch also when the value equals false this fixes #888
          [id]:
            value || (value !== undefined && isBoolean(value)) ? value : null,
        },
      };
    });
  }

  hideHandler = (data) => {
    return !!data.fixed || !blockHasValue(data);
  };

  /**
   * Change block handler
   * @method onChangeBlock
   * @param {string} id Id of the block
   * @param {*} value Value of the field
   * @returns {undefined}
   */
  onChangeBlock(id, value) {
    const blocksFieldname = getBlocksFieldname(this.state.formData);
    this.setState({
      formData: {
        ...this.state.formData,
        [blocksFieldname]: {
          ...this.state.formData[blocksFieldname],
          [id]: value || null,
        },
      },
    });
  }

  /**
   * Change block handler
   * @method onMutateBlock
   * @param {string} id Id of the block
   * @param {*} value Value of the field
   * @returns {undefined}
   */
  onMutateBlock(id, value) {
    const blocksFieldname = getBlocksFieldname(this.state.formData);
    const blocksLayoutFieldname = getBlocksLayoutFieldname(this.state.formData);
    const index =
      this.state.formData[blocksLayoutFieldname].items.indexOf(id) + 1;

    // Test if block at index is already a placeholder (trailing) block
    const trailId = this.state.formData[blocksLayoutFieldname].items[index];
    if (trailId) {
      const block = this.state.formData[blocksFieldname][trailId];
      if (!blockHasValue(block)) {
        this.setState({
          formData: {
            ...this.state.formData,
            [blocksFieldname]: {
              ...this.state.formData[blocksFieldname],
              [id]: value || null,
            },
          },
        });
        return;
      }
    }

    const idTrailingBlock = uuid();
    this.setState({
      formData: {
        ...this.state.formData,
        [blocksFieldname]: {
          ...this.state.formData[blocksFieldname],
          [id]: value || null,
          [idTrailingBlock]: {
            '@type': config.settings.defaultBlockType,
          },
        },
        [blocksLayoutFieldname]: {
          items: [
            ...this.state.formData[blocksLayoutFieldname].items.slice(0, index),
            idTrailingBlock,
            ...this.state.formData[blocksLayoutFieldname].items.slice(index),
          ],
        },
      },
    });
  }

  /**
   * Select block handler
   * @method onSelectBlock
   * @param {string} id Id of the field
   * @param {string} isMultipleSelection true if multiple blocks are selected
   * @returns {undefined}
   */
  onSelectBlock(id, isMultipleSelection, event) {
    let multiSelected = [];
    let selected = id;

    if (isMultipleSelection) {
      selected = null;
      const blocksLayoutFieldname = getBlocksLayoutFieldname(
        this.state.formData,
      );

      const blocks_layout = this.state.formData[blocksLayoutFieldname].items;

      if (event.shiftKey) {
        const anchor =
          this.state.multiSelected.length > 0
            ? blocks_layout.indexOf(this.state.multiSelected[0])
            : blocks_layout.indexOf(this.state.selected);
        const focus = blocks_layout.indexOf(id);

        if (anchor === focus) {
          multiSelected = [id];
        } else if (focus > anchor) {
          multiSelected = [...blocks_layout.slice(anchor, focus + 1)];
        } else {
          multiSelected = [...blocks_layout.slice(focus, anchor + 1)];
        }
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
        if (this.state.multiSelected.includes(id)) {
          selected = null;
          multiSelected = without(this.state.multiSelected, id);
        } else {
          multiSelected = [...(this.state.multiSelected || []), id];
        }
      }
    }

    this.setState({
      selected,
      multiSelected,
    });
  }

  /**
   * Delete block handler
   * @method onDeleteBlock
   * @param {string} id Id of the field
   * @param {bool} selectPrev True if previous should be selected
   * @returns {undefined}
   */
  onDeleteBlock(id, selectPrev) {
    const { settings } = config;
    const blocksFieldname = getBlocksFieldname(this.state.formData);
    const blocksLayoutFieldname = getBlocksLayoutFieldname(this.state.formData);

    this.setState(
      {
        formData: {
          ...this.state.formData,
          [blocksLayoutFieldname]: {
            items: without(
              this.state.formData[blocksLayoutFieldname].items,
              id,
            ),
          },
          [blocksFieldname]: omit(this.state.formData[blocksFieldname], [id]),
        },
        selected: selectPrev
          ? this.state.formData[blocksLayoutFieldname].items[
              this.state.formData[blocksLayoutFieldname].items.indexOf(id) - 1
            ]
          : null,
        multiSelected: without(this.state.multiSelected || [], id),
      },
      (newState) => {
        if (this.state.formData[blocksLayoutFieldname].items.length === 0) {
          this.onAddBlock(settings.defaultBlockType, 0);
        }
      },
    );
  }

  /**
   * Add block handler
   * @method onAddBlock
   * @param {string} type Type of the block
   * @param {Number} index Index where to add the block
   * @returns {string} Id of the block
   */
  onAddBlock(type, index) {
    const { settings } = config;
    const id = uuid();
    const idTrailingBlock = uuid();
    const blocksFieldname = getBlocksFieldname(this.state.formData);
    const blocksLayoutFieldname = getBlocksLayoutFieldname(this.state.formData);
    const totalItems = this.state.formData[blocksLayoutFieldname].items.length;
    const insert = index === -1 ? totalItems : index;

    this.setState({
      formData: {
        ...this.state.formData,
        [blocksLayoutFieldname]: {
          items: [
            ...this.state.formData[blocksLayoutFieldname].items.slice(
              0,
              insert,
            ),
            id,
            ...(type !== settings.defaultBlockType ? [idTrailingBlock] : []),
            ...this.state.formData[blocksLayoutFieldname].items.slice(insert),
          ],
        },
        [blocksFieldname]: {
          ...this.state.formData[blocksFieldname],
          [id]: {
            '@type': type,
          },
          ...(type !== settings.defaultBlockType && {
            [idTrailingBlock]: {
              '@type': settings.defaultBlockType,
            },
          }),
        },
      },
      selected: id,
    });

    return id;
  }

  /**
   * Submit handler also validate form and collect errors
   * @method onSubmit
   * @param {Object} event Event object.
   * @returns {undefined}
   */
  onSubmit(event) {
    if (event) {
      event.preventDefault();
    }

    const errors = FormValidation.validateFieldsPerFieldset({
      schema: this.props.schema,
      formData: this.state.formData,
      formatMessage: this.props.intl.formatMessage,
    });

    if (keys(errors).length > 0) {
      const activeIndex = FormValidation.showFirstTabWithErrors({
        errors,
        schema: this.props.schema,
      });
      this.setState(
        {
          errors,
          activeIndex,
        },
        () => {
          Object.keys(errors).forEach((err) =>
            toast.error(
              <Toast error title={err} content={errors[err].join(', ')} />,
            ),
          );
        },
      );
    } else {
      // Get only the values that have been modified (Edit forms), send all in case that
      // it's an add form
      if (this.props.isEditForm) {
        this.props.onSubmit(this.getOnlyFormModifiedValues());
      } else {
        this.props.onSubmit(this.state.formData);
      }
      if (this.props.resetAfterSubmit) {
        this.setState({
          formData: this.props.formData,
        });
      }
    }
  }

  /**
   * getOnlyFormModifiedValues handler
   * It returns only the values of the fields that are have really changed since the
   * form was loaded. Useful for edit forms and PATCH operations, when we only want to
   * send the changed data.
   * @method getOnlyFormModifiedValues
   * @param {Object} event Event object.
   * @returns {undefined}
   */
  getOnlyFormModifiedValues = () => {
    const fieldsModified = Object.keys(
      difference(this.state.formData, this.state.initialFormData),
    );
    return {
      ...pickBy(this.state.formData, (value, key) =>
        fieldsModified.includes(key),
      ),
      ...(this.state.formData['@static_behaviors'] && {
        '@static_behaviors': this.state.formData['@static_behaviors'],
      }),
    };
  };

  /**
   * Move block handler
   * @method onMoveBlock
   * @param {number} dragIndex Drag index.
   * @param {number} hoverIndex Hover index.
   * @returns {undefined}
   */
  onMoveBlock(dragIndex, hoverIndex) {
    const blocksLayoutFieldname = getBlocksLayoutFieldname(this.state.formData);

    this.setState({
      formData: {
        ...this.state.formData,
        [blocksLayoutFieldname]: {
          items: move(
            this.state.formData[blocksLayoutFieldname].items,
            dragIndex,
            hoverIndex,
          ),
        },
      },
    });
  }

  /**
   *
   * @method onFocusPreviousBlock
   * @param {string} currentBlock The id of the current block
   * @param {node} blockNode The id of the current block
   * @param {boolean} isMultipleSelection true if multiple blocks selected
   * @returns {undefined}
   */
  onFocusPreviousBlock(currentBlock, blockNode, isMultipleSelection) {
    const blocksLayoutFieldname = getBlocksLayoutFieldname(this.state.formData);
    const currentIndex = this.state.formData[
      blocksLayoutFieldname
    ].items.indexOf(currentBlock);

    if (currentIndex === 0) {
      // We are already at the top block don't do anything
      return;
    }
    const newindex = currentIndex - 1;
    blockNode.blur();

    this.onSelectBlock(
      this.state.formData[blocksLayoutFieldname].items[newindex],
      isMultipleSelection,
    );
  }

  /**
   *
   * @method onFocusNextBlock
   * @param {string} currentBlock The id of the current block
   * @param {node} blockNode The id of the current block
   * @param {boolean} isMultipleSelection true if multiple blocks selected
   * @returns {undefined}
   */
  onFocusNextBlock(currentBlock, blockNode, isMultipleSelection) {
    const blocksLayoutFieldname = getBlocksLayoutFieldname(this.state.formData);
    const currentIndex = this.state.formData[
      blocksLayoutFieldname
    ].items.indexOf(currentBlock);

    if (
      currentIndex ===
      this.state.formData[blocksLayoutFieldname].items.length - 1
    ) {
      // We are already at the bottom block don't do anything
      return;
    }

    const newindex = currentIndex + 1;
    blockNode.blur();

    this.onSelectBlock(
      this.state.formData[blocksLayoutFieldname].items[newindex],
      isMultipleSelection,
    );
  }

  /**
   * handleKeyDown, sports a way to disable the listeners via an options named
   * parameter
   * @method handleKeyDown
   * @param {object} e Event
   * @param {number} index Block index
   * @param {string} block Block type
   * @param {node} node The block node
   * @returns {undefined}
   */
  handleKeyDown(
    e,
    index,
    block,
    node,
    {
      disableEnter = false,
      disableArrowUp = false,
      disableArrowDown = false,
    } = {},
  ) {
    const { settings } = config;
    const isMultipleSelection = e.shiftKey;
    if (e.key === 'ArrowUp' && !disableArrowUp) {
      this.onFocusPreviousBlock(block, node, isMultipleSelection);
      e.preventDefault();
    }
    if (e.key === 'ArrowDown' && !disableArrowDown) {
      this.onFocusNextBlock(block, node, isMultipleSelection);
      e.preventDefault();
    }
    if (e.key === 'Enter' && !disableEnter) {
      this.onAddBlock(settings.defaultBlockType, index + 1);
      e.preventDefault();
    }
  }

  /**
   * Removed blocks and blocks_layout fields from the form.
   * @method removeBlocksLayoutFields
   * @param {object} schema The schema definition of the form.
   * @returns A modified copy of the given schema.
   */
  removeBlocksLayoutFields = (schema) => {
    const newSchema = { ...schema };
    const layoutFieldsetIndex = findIndex(
      newSchema.fieldsets,
      (fieldset) => fieldset.id === 'layout',
    );
    if (layoutFieldsetIndex > -1) {
      const layoutFields = newSchema.fieldsets[layoutFieldsetIndex].fields;
      newSchema.fieldsets[layoutFieldsetIndex].fields = layoutFields.filter(
        (field) => field !== 'blocks' && field !== 'blocks_layout',
      );
      if (newSchema.fieldsets[layoutFieldsetIndex].fields.length === 0) {
        newSchema.fieldsets = [
          ...newSchema.fieldsets.slice(0, layoutFieldsetIndex),
          ...newSchema.fieldsets.slice(layoutFieldsetIndex + 1),
        ];
      }
    }
    return newSchema;
  };

  onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) {
      return;
    }
    const blocksLayoutFieldname = getBlocksLayoutFieldname(this.state.formData);
    this.setState({
      placeholderProps: {},
    });
    this.setState({
      formData: {
        ...this.state.formData,
        [blocksLayoutFieldname]: {
          items: move(
            this.state.formData[blocksLayoutFieldname].items,
            source.index,
            destination.index,
          ),
        },
      },
    });
  };

  handleDragStart = (event) => {
    const queryAttr = 'data-rbd-draggable-id';
    const domQuery = `[${queryAttr}='${event.draggableId}']`;
    const draggedDOM = document.querySelector(domQuery);

    if (!draggedDOM) {
      return;
    }

    const { clientHeight, clientWidth } = draggedDOM;
    const sourceIndex = event.source.index;
    var clientY =
      parseFloat(window.getComputedStyle(draggedDOM.parentNode).paddingTop) +
      [...draggedDOM.parentNode.children]
        .slice(0, sourceIndex)
        .reduce((total, curr) => {
          const style = curr.currentStyle || window.getComputedStyle(curr);
          const marginBottom = parseFloat(style.marginBottom);
          return total + curr.clientHeight + marginBottom;
        }, 0);

    this.setState({
      placeholderProps: {
        clientHeight,
        clientWidth,
        clientY,
        clientX: parseFloat(
          window.getComputedStyle(draggedDOM.parentNode).paddingLeft,
        ),
      },
    });
  };

  onDragUpdate = (update) => {
    if (!update.destination) {
      return;
    }
    const draggableId = update.draggableId;
    const destinationIndex = update.destination.index;

    const queryAttr = 'data-rbd-draggable-id';
    const domQuery = `[${queryAttr}='${draggableId}']`;
    const draggedDOM = document.querySelector(domQuery);

    if (!draggedDOM) {
      return;
    }
    const { clientHeight, clientWidth } = draggedDOM;
    const sourceIndex = update.source.index;
    const childrenArray = [...draggedDOM.parentNode.children];
    const movedItem = childrenArray[sourceIndex];
    childrenArray.splice(sourceIndex, 1);

    const updatedArray = [
      ...childrenArray.slice(0, destinationIndex),
      movedItem,
      ...childrenArray.slice(destinationIndex + 1),
    ];

    var clientY =
      parseFloat(window.getComputedStyle(draggedDOM.parentNode).paddingTop) +
      updatedArray.slice(0, destinationIndex).reduce((total, curr) => {
        const style = curr.currentStyle || window.getComputedStyle(curr);
        const marginBottom = parseFloat(style.marginBottom);
        return total + curr.clientHeight + marginBottom;
      }, 0);

    this.setState({
      placeholderProps: {
        clientHeight,
        clientWidth,
        clientY,
        clientX: parseFloat(
          window.getComputedStyle(draggedDOM.parentNode).paddingLeft,
        ),
      },
    });
  };

  /**
   * Render method.
   * @method render
   * @returns {string} Markup for the component.
   */
  render() {
    const { settings } = config;
    const { schema: originalSchema, onCancel, onSubmit } = this.props;
    const { formData, placeholderProps } = this.state;
    const blocksFieldname = getBlocksFieldname(formData);
    const blocksLayoutFieldname = getBlocksLayoutFieldname(formData);
    const renderBlocks = formData?.[blocksLayoutFieldname]?.items;
    const blocksDict = formData?.[blocksFieldname];
    const schema = this.removeBlocksLayoutFields(originalSchema);

    return this.props.visual ? (
      // Removing this from SSR is important, since react-beautiful-dnd supports SSR,
      // but draftJS don't like it much and the hydration gets messed up
      this.state.isClient && (
        <div className="ui container">
          <BlocksToolbar
            formData={this.state.formData}
            selectedBlock={this.state.selected}
            selectedBlocks={this.state.multiSelected}
            onChangeBlocks={(newBlockData) =>
              this.setState({
                formData: {
                  ...formData,
                  ...newBlockData,
                },
              })
            }
            onSetSelectedBlocks={(blockIds) =>
              this.setState({ multiSelected: blockIds })
            }
            onSelectBlock={this.onSelectBlock}
          />
          <DragDropContext
            onDragEnd={this.onDragEnd}
            onDragStart={this.handleDragStart}
            onDragUpdate={this.onDragUpdate}
          >
            <Droppable droppableId="edit-form">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{ position: 'relative' }}
                >
                  {map(renderBlocks, (block, index) => (
                    <Draggable draggableId={block} index={index} key={block}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`block-editor-${blocksDict[block]['@type']}`}
                        >
                          <div style={{ position: 'relative' }}>
                            <div
                              style={{
                                visibility:
                                  this.state.selected === block &&
                                  !this.hideHandler(blocksDict[block])
                                    ? 'visible'
                                    : 'hidden',
                                display: 'inline-block',
                              }}
                              {...provided.dragHandleProps}
                              className="drag handle wrapper"
                            >
                              <Icon name={dragSVG} size="18px" />
                            </div>

                            <EditBlock
                              id={block}
                              index={index}
                              type={blocksDict[block]['@type']}
                              key={block}
                              handleKeyDown={this.handleKeyDown}
                              onAddBlock={this.onAddBlock}
                              onChangeBlock={this.onChangeBlock}
                              onMutateBlock={this.onMutateBlock}
                              onChangeField={this.onChangeField}
                              onDeleteBlock={this.onDeleteBlock}
                              onSelectBlock={this.onSelectBlock}
                              onMoveBlock={this.onMoveBlock}
                              onFocusPreviousBlock={this.onFocusPreviousBlock}
                              onFocusNextBlock={this.onFocusNextBlock}
                              properties={formData}
                              data={blocksDict[block]}
                              pathname={this.props.pathname}
                              block={block}
                              selected={this.state.selected === block}
                              multiSelected={this.state.multiSelected.includes(
                                block,
                              )}
                              manage={this.props.isAdminForm}
                              allowedBlocks={this.props.allowedBlocks}
                              showRestricted={this.props.showRestricted}
                            />
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {!isEmpty(placeholderProps) && (
                    <div
                      style={{
                        position: 'absolute',
                        top: `${placeholderProps.clientY}px`,
                        height: `${placeholderProps.clientHeight + 18}px`,
                        background: '#eee',
                        width: `${placeholderProps.clientWidth}px`,
                        borderRadius: '3px',
                      }}
                    ></div>
                  )}
                </div>
              )}
            </Droppable>
            {this.state.isClient && (
              <Portal
                node={__CLIENT__ && document.getElementById('sidebar-metadata')}
              >
                <UiForm
                  method="post"
                  onSubmit={this.onSubmit}
                  error={keys(this.state.errors).length > 0}
                >
                  {schema &&
                    map(schema.fieldsets, (item) => [
                      <Segment secondary attached key={item.title}>
                        {item.title}
                      </Segment>,
                      <Segment attached key={`fieldset-contents-${item.title}`}>
                        {map(item.fields, (field, index) => (
                          <Field
                            {...schema.properties[field]}
                            id={field}
                            formData={this.state.formData}
                            focus={false}
                            value={this.state.formData?.[field]}
                            required={schema.required.indexOf(field) !== -1}
                            onChange={this.onChangeField}
                            onBlur={this.onBlurField}
                            onClick={this.onClickInput}
                            key={field}
                            error={this.state.errors[field]}
                          />
                        ))}
                      </Segment>,
                    ])}
                </UiForm>
              </Portal>
            )}
          </DragDropContext>
        </div>
      )
    ) : (
      <Container>
        <UiForm
          method="post"
          onSubmit={this.onSubmit}
          error={keys(this.state.errors).length > 0}
          className={settings.verticalFormTabs ? 'vertical-form' : ''}
        >
          <Segment.Group raised>
            {schema && schema.fieldsets.length > 1 && (
              <>
                {settings.verticalFormTabs && this.props.title && (
                  <Segment secondary attached key={this.props.title}>
                    {this.props.title}
                  </Segment>
                )}
                <Tab
                  menu={{
                    secondary: true,
                    pointing: true,
                    attached: true,
                    tabular: true,
                    className: 'formtabs',
                    vertical: settings.verticalFormTabs,
                  }}
                  grid={{ paneWidth: 9, tabWidth: 3, stackable: true }}
                  onTabChange={this.onTabChange}
                  activeIndex={this.state.activeIndex}
                  panes={map(schema.fieldsets, (item) => ({
                    menuItem: item.title,
                    render: () => [
                      !settings.verticalFormTabs && this.props.title && (
                        <Segment secondary attached key={this.props.title}>
                          {this.props.title}
                        </Segment>
                      ),
                      ...map(item.fields, (field, index) => (
                        <Field
                          {...schema.properties[field]}
                          id={field}
                          formData={this.state.formData}
                          fieldSet={item.title.toLowerCase()}
                          focus={index === 0}
                          value={this.state.formData?.[field]}
                          required={schema.required.indexOf(field) !== -1}
                          onChange={this.onChangeField}
                          onBlur={this.onBlurField}
                          onClick={this.onClickInput}
                          key={field}
                          error={this.state.errors[field]}
                        />
                      )),
                    ],
                  }))}
                />
              </>
            )}
            {schema && schema.fieldsets.length === 1 && (
              <Segment>
                {this.props.title && (
                  <Segment className="primary">
                    <h1 style={{ fontSize: '16px' }}> {this.props.title}</h1>
                  </Segment>
                )}
                {this.props.description && (
                  <Segment secondary>{this.props.description}</Segment>
                )}
                {keys(this.state.errors).length > 0 && (
                  <Message
                    icon="warning"
                    negative
                    attached
                    header={this.props.intl.formatMessage(messages.error)}
                    content={this.props.intl.formatMessage(
                      messages.thereWereSomeErrors,
                    )}
                  />
                )}
                {this.props.error && (
                  <Message
                    icon="warning"
                    negative
                    attached
                    header={this.props.intl.formatMessage(messages.error)}
                    content={this.props.error.message}
                  />
                )}
                {map(schema.fieldsets[0].fields, (field) => (
                  <Field
                    {...schema.properties[field]}
                    id={field}
                    value={this.state.formData?.[field]}
                    required={schema.required.indexOf(field) !== -1}
                    onChange={this.onChangeField}
                    onBlur={this.onBlurField}
                    onClick={this.onClickInput}
                    key={field}
                    error={this.state.errors[field]}
                  />
                ))}
              </Segment>
            )}
            {!this.props.hideActions && (
              <Segment className="actions" clearing>
                {onSubmit && (
                  <Button
                    basic
                    primary
                    floated="right"
                    type="submit"
                    aria-label={
                      this.props.submitLabel
                        ? this.props.submitLabel
                        : this.props.intl.formatMessage(messages.save)
                    }
                    title={
                      this.props.submitLabel
                        ? this.props.submitLabel
                        : this.props.intl.formatMessage(messages.save)
                    }
                    loading={this.props.loading}
                  >
                    <Icon className="circled" name={aheadSVG} size="30px" />
                  </Button>
                )}
                {onCancel && (
                  <Button
                    basic
                    secondary
                    aria-label={this.props.intl.formatMessage(messages.cancel)}
                    title={this.props.intl.formatMessage(messages.cancel)}
                    floated="right"
                    onClick={onCancel}
                  >
                    <Icon className="circled" name={clearSVG} size="30px" />
                  </Button>
                )}
              </Segment>
            )}
          </Segment.Group>
        </UiForm>
      </Container>
    );
  }
}

export default injectIntl(Form, { forwardRef: true });
