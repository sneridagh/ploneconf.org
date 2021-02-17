# Blocks - Edit components

The edit component part of a block anatomy is specially different to the view component because they have to support the UX for editing the block.
This UX can be very complex depending on the kind of block and the feature that it is trying to provide.
The project requirements will tell how far you should go with the UX story of each tile, and how complex it will become.
You can use all the props that the edit component is receiving to model the UX for the block and how it will render.

See the [complete list of props](anatomy.md#block-edit-component-props).

We have several UI/UX artifacts in order to model our block edit component UX.
The sidebar and the object browser are the main ones.

## Sidebar

We can use the new sidebar when building our blocks' edit components.
The sidebar is a new UI asset that is available in Volto 4.
You need to instantiate it this way:

```jsx
import { SidebarPortal } from '@plone/volto/components';

[...]

<SidebarPortal selected={this.props.selected}>
  ...
</SidebarPortal>
```

Everything that's inside the `SidebarPortal` component will be rendered in the sidebar.

## Automated block editing forms

To simplify the task of defining the edit component for a block, the `InlineForm` component can be used. The block edit component needs to be described by a schema that matches the format used to serialize the content type definitions. The widgets that will be used in rendering the form follow the same algorithm that is used for the regular metadata fields for the content types. As an example of schema, it could look like this:

```js
const IframeSchema = {
  title: 'Embed external content',

  fieldsets: [
    {
      id: 'default',
      title: 'Default',
      fields: [
        'url',
        'align',
        'privacy_statement',
        'privacy_cookie_key',
        'enabled',
      ],
    },
  ],

  properties: {
    url: {
      title: 'Embed URL',
    },
    privacy_statement: {
      title: 'Privacy statement',
      description: 'Short notification text',
      widget: 'text',
    },
    privacy_cookie_key: {
      title: 'Privacy cookie key',
      description: 'Identifies similar external content',
    },
    enabled: {
      title: 'Use privacy screen?',
      description: 'Enable/disable the privacy protection',
      type: 'boolean',
    },
  },

  required: ['url'],
};

export default IframeSchema;
```

To render this form and make it available to the edit component:

```jsx
import schema from './schema';
import InlineForm from '@plone/volto/components/manage/Form/InlineForm';
import { Icon } from '@plone/volto/components';

<SidebarPortal selected={this.props.selected}>
  <InlineForm
    icon={<Icon size="24px" name={nameSVG} />}
    schema={schema}
    title={schema.title}
    headerActions={<button onClick={() => {}}>Action</button>}
    footer={<div>I'm footer</div>}
    onChangeField={(id, value) => {
      this.props.onChangeBlock(this.props.block, {
        ...this.props.data,
        [id]: value,
      });
    }}
    formData={this.props.data}
  />
</SidebarPortal>;
```

## Object Browser

Volto 4 has a new object browser component that allows you to select an existing content object from the site.
It has the form of an HOC (High Order Component), so you have to wrap the component you want to be able to call the object browser from with it, like this:

```js
import withObjectBrowser from '@plone/volto/components/manage/Sidebar/ObjectBrowser';

[...]

export default withObjectBrowser(MyComponent)
```

The HOC component `withObjectBrowser` wraps your component by making available this props:

- isObjectBrowserOpen - (Bool) tells if the browser is currently open
- openObjectBrowser - handler for opening the browser
- closeObjectBrowser - handler for closing the browser

By default, it's enabled for all the component tree under the Blocks Editor, so it's available already for all the blocks in edit mode.
However, if you need to instantiate it somewhere else, you can do it anyways by wrapping your component with it.

!!! note
    The default image block in Volto features both the Sidebar and the object browser, take a look at its source code in case you need more context on how they work.

### openObjectBrowser handler API

If you want to open an `ObjectBrowser` from your Block, you need to call the `openObjectBrowser` function you'll find in the props of your block component.
This function has this signature:

```
@param {Object} object ObjectBrowser configuration.
@param {string} object.mode Quick mode, defaults to `image`.
@param {string} object.dataName Name of the block data property to write the selected item.
@param {string} object.onSelectItem Function that will be called on item selection.
```

These are some examples on how to use it:

```js
// Opens the browser in the `image` mode by default if no config object specified, so it saves the selection in the `url` data property.
this.props.openObjectBrowser();

// Opens the browser in the `link` mode, so it saves the selection in the `href` data property.
this.props.openObjectBrowser({ mode: 'link' });

// Opens the browser defining which data property should save the selection using `dataName`
this.props.openObjectBrowser({
  dataName: 'myfancydatafield',
});

// Opens the browser defining the function that should be used to save the selection using `onSelectItem`
this.props.openObjectBrowser({
  onSelectItem: (url) =>
    this.props.onChangeBlock(this.props.block, {
      ...this.props.data,
      myfancydatafield: url,
    }),
});
```

### ObjectBrowserWidget

This widget shows an objectBrowser to find content/contents on site.

It is the default widget for vocabulary fields that uses plone.app.vocabularies.Catalog.

It works in 3 different mode:

- **image**: The field value is an object.
  The path of selected item is saved in 'url' property of value object. (fieldName: {url:''})
- **link**: The field value is an object.
  The path of selected item is saved in 'href' property of value object. (fieldName: {href:''})
- **multiple**: The field value is an array of objects.

#### PropDataName vs dataName

- **dataName** is the prop inside _data_ object, used for _link_ and _image_ mode.
- **PropDataName** is the name of field wich value is _data_. It's used for _multiple_ mode.

For example:

```js
content:{ '@id': 'page-1', related_pages:[], image:{url:""}, link:{href:""} }
```

if we use object browser widget for fields:

- **related_pages**: propDataName is _related_pages_ and dataName is null,
- **image**: dataName is _url_ and propDataName is null
- **link**: dataName is _href_ and propDataName is null

#### Usage in blocks schema

Used in along with `InlineForm`, one can instantiate and configure it using the widget props like this:

```js
{
  title: 'Item',
  fieldsets: [
    {
      id: 'default',
      title: 'Default',
      fields: ['href'],
    },
  ],
  properties: {
    href: {
      title: 'title',
      widget: 'object_browser',
      mode: 'link',
      selectedItemAttrs: ['Title', 'Description'],
    },
}
```

#### selectedItemAttrs

You can select the attributes from the object (coming from the metadata brain from
@search endpoint used in the browser) using the `selectedItemAttrs` prop as shown in the
last example.

#### ObjectBrowserWidgetMode()

Returns the component widget with _mode_ passed as argument.

The default mode for ObjectBrowserWidget is multiple. If you would like to use this widget with link or image mode as widget field for a specific field id (for example), you could specify in in config.js as:

```jsx
export const widgets = {
  widgetMapping: {
    ...widgetMapping,
    id: {
      ...widgetMapping.id,
      my_image_field: ObjectBrowserWidgetMode('image'),
      my_link_field: ObjectBrowserWidgetMode('link'),
    },
  },
  default: defaultWidget,
};
```

#### Selectable types

If **selectableTypes** is set in _widgetOptions.pattern_options_, widget allows to select only items that matches types defined in _widgetOptions.pattern_options.selectableTypes_.

```jsx
<ObjectBrowserWidget ... widgetOptions={{pattern_options:{selectableTypes:['News Item','Event']}}}>
```

You can also set the _selectableTypes_ from plone when declaring a field for contenttype:

```jsx
form.widget(
  'a_cura_di',
  RelatedItemsFieldWidget,
  (vocabulary = 'plone.app.vocabularies.Catalog'),
  (pattern_options = {
    maximumSelectionSize: 1,
    selectableTypes: ['News Item', 'Event'],
  }),
);
```

#### MaximumSelectionSize

If **maximumSelectionSize** is set in _widgetOptions.pattern_options_, widget allows to select at most the **maximumSelectionSize** number of items defined in _widgetOptions.pattern_options.maximumSelectionSize_.

```jsx
<ObjectBrowserWidget ... widgetOptions={{pattern_options:{maximumSelectionSize:2}}}>
```

You can also set the _maximumSelectionSize_ from plone when declaring a field for contenttype:

```jsx
form.widget(
  'a_cura_di',
  RelatedItemsFieldWidget,
  (vocabulary = 'plone.app.vocabularies.Catalog'),
  (pattern_options = { maximumSelectionSize: 1, selectableTypes: ['Event'] }),
);
```

```jsx
form.widget(
  'notizie_correlate',
  RelatedItemsFieldWidget,
  (vocabulary = 'plone.app.vocabularies.Catalog'),
  (pattern_options = {
    maximumSelectionSize: 10,
    selectableTypes: ['News Item'],
  }),
);
```

## Reusing the blocks engine in your components

You can render a blocks engine form with the `BlocksForm` component.

```jsx
import { isEmpty } from 'lodash';
import BlocksForm from '@plone/volto/components/manage/Blocks/BlocksForm';
import { emptyBlocksForm } from '@plone/volto/helpers/Blocks/Blocks';


class Example extends Component {

  constructor(props) {
    super(props);
    this.state = {
      selectedBlock: null,
      formData: null,
    }
    this.blocksState = {};
  }

  render() {
    const {
      block,
      data,
      onChangeBlock,
      pathname,
      selected,
      manage,
    } = this.props;
    const formData = this.state.formData;
    const metadata = this.props.metadata || this.props.properties;

    return (
      <BlocksForm
        title="A form with blocks"
        description={data?.instructions?.data}
        manage={manage}
        allowedBlocks={data?.allowedBlocks}
        metadata={metadata}
        properties={isEmpty(formData) ? emptyBlocksForm() : formData}
        selectedBlock={
          selected ? this.state.selectedBlock : null
        }
        onSelectBlock={(id) => this.setState({ selectedBlock: id }) }
        onChangeFormData={(newFormData) => {
          onChangeBlock(block, {
            ...data,
            data: {
              ...formData,
            },
          });
        }}
        onChangeField={(id, value) => {
          if (['blocks', 'blocks_layout'].indexOf(id) > -1) {
            this.blockState[id] = value;
            onChangeBlock(block, {
              ...data,
              data: {
                ...data.data,
                ...this.blockState,
              },
            });
          }
        }}
        pathname={pathname}
      >
      </BlocksForm>
    );
  }
}
```

The current block engine, available as the separate `BlocksForm` component is
a replication of the block engine from the `Form.jsx` component. It has been
previously exposed as the
[@eeacms/volto-blocks-form](https://github.com/eea/volto-blocks-form) addon and
reused in several other addons, so you can find integration examples in addons
such as [volto-columns-block](https://github.com/eea/volto-columns-block),
[volto-accordion-block](https://github.com/rohberg/volto-accordion-block),
[@eeacms/volto-accordion-block](https://github.com/eea/volto-accordion-block),
[@eeacms/volto-grid-block](https://github.com/eea/volto-accordion-block), but
probably the simplest implementation to follow is in the
[@eeacms/volto-group-block](https://github.com/eea/volto-group-block)

Notice that the `BlocksForm` component allows overriding the edit block
wrapper. You can also reuse the DragDropList component as a separate component:

```jsx
  <DragDropList
    childList={childList}
    as="tbody"
    onMoveItem={(result) => {
      const { source, destination } = result;
      const ns = JSON.parse(JSON.stringify(state));
      Object.keys(ns.order).forEach((lang) => {
        const x = ns.order[lang][source.index];
        const y = ns.order[lang][destination.index];
        ns.order[lang][destination.index] = x;
        ns.order[lang][source.index] = y;
      });
      setState(ns);
      return true;
    }}
  >
    {({ index, draginfo }) => {
      return (
        <Ref innerRef={draginfo.innerRef} key={index}>
          <Table.Row {...draginfo.draggableProps}>
            <Table.Cell>
              <div {...draginfo.dragHandleProps}>
                <Icon name={dragSVG} size="18px" />
              </div>
            </Table.Cell>
            {langs.map((lang) => {
              const i = state.order[lang][index];
              const entry = state.data[lang][i];
              return (
                <Table.Cell key={lang}>
                  <TermInput
                    entry={entry}
                    onChange={(id, value) => {
                      const newState = { ...state };
                      newState.data[lang][i] = {
                        ...newState.data[lang][i],
                        [id]: value,
                      };

                      setState(newState);
                    }}
                  />
                </Table.Cell>
              );
            })}
            <Table.Cell>
              <Button basic onClick={() => {}}>
                <Icon
                  className="circled"
                  name={deleteSVG}
                  size="12px"
                />
              </Button>
            </Table.Cell>
          </Table.Row>
        </Ref>
      );
    }}
  </DragDropList>
```

Check the source code of volto-columns-block and
[volto-taxonomy](https://github.com/eea/volto-taxonomy/) for details on
how to reuse this component.