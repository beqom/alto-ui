import React from 'react';
import PropTypes from 'prop-types';
import debounce from 'lodash.debounce';
import isEqual from 'lodash.isequal';

import Dropdown from '../../../Dropdown';
import OptionsIcon from '../../../Icons/Options';
import DatagridCellInput from '../DatagridCellInput/DatagridCellInput';
import Calendar from '../../../Icons/Calendar';
import CaretDown from '../../../Icons/CaretDown';

import DataGridCellError from './components/DataGridCellError';

import {
  getFormattedValue,
  getValue,
  getFormatter,
  getType,
  IDENTITY,
  getTitleValue,
} from '../../helpers';

import { bemClass } from '../../../helpers/bem';

import './DatagridCell.scss';

const diff = (a, b) => {
  const aEntries = Object.entries(a || {});
  return (
    aEntries.some(([key, value]) => typeof value !== 'function' && value !== b[key]) ||
    aEntries.length !== Object.values(b || {}).length
  );
};

class DatagridCell extends React.Component {
  constructor(props) {
    super(props);

    const value = props.row[props.column.key];
    this.state = {
      editing: false,
      value,
      // eslint-disable-next-line react/no-unused-state
      originalValue: value,
    };

    const { onChangeDebounceTime } = props.context;

    this.startEditing = this.startEditing.bind(this);
    this.stopEditing = this.stopEditing.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.format = this.format.bind(this);
    this.handleClickEditButton = this.handleClickEditButton.bind(this);
    const propagateChange = this.propagateChange.bind(this);
    this.replaceRowValues = this.replaceRowValues.bind(this);
    this.propagateChange = onChangeDebounceTime
      ? debounce(propagateChange, onChangeDebounceTime)
      : propagateChange;

    this.cellRef = React.createRef();
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (!nextProps.column.formula || nextProps.header) {
      const nextValue = nextProps.row[nextProps.column.key || nextProps.column];
      if (nextValue !== prevState.originalValue) {
        return {
          value: nextValue,
          originalValue: nextValue,
        };
      }
    }
    return null;
  }

  shouldComponentUpdate(nextProps, nextState) {
    const type = getType(this.getValue(), nextProps.column);
    if ((nextProps.context.renderers || {})[type]) return true;
    if (nextProps.render) return true;
    if (!isEqual(this.state, nextState)) {
      return true;
    }
    return (
      diff(this.props.inputProps, nextProps.inputProps) ||
      this.props.row !== nextProps.row ||
      this.props.selectedRowKey !== nextProps.selectedRowKey ||
      this.props.width !== nextProps.width ||
      this.props.colIndex !== nextProps.colIndex ||
      this.props.rowIndex !== nextProps.rowIndex ||
      this.props.context.compact !== nextProps.context.compact ||
      this.props.context.comfortable !== nextProps.context.comfortable
    );
  }

  getValue() {
    const { row, column, render, header } = this.props;
    if (render) return '';
    if (header) return this.state.value;
    return getValue(this.state.value, column, row);
  }

  getFormattedValue() {
    const { context, row, column } = this.props;
    const value = this.getValue();
    const type = getType(value, column);
    const format = getFormatter(context, type);
    return format(value, column, row);
  }

  getStyle() {
    const { width, column } = this.props;
    const minWidth = column.editable ? '4.625rem' : '2rem';
    return { width, minWidth, maxWidth: width };
  }

  getModifiers() {
    const { editing } = this.state;
    const {
      context,
      row,
      column,
      edited,
      editable,
      disabled,
      header,
      summary,
      selectedRowKey,
      clickable,
      detached,
      aria,
      lastRow,
    } = this.props;
    const value = this.getValue();
    const type = getType(value, column);
    const selected = selectedRowKey && context.rowKeyField(row) === selectedRowKey;

    return {
      ...(type && type !== 'undefined' ? { [type]: true } : {}),
      formula: !!column.formula,
      editable,
      editing: editing || ['boolean'].includes(type),
      edited,
      focus: editing,
      disabled,
      header,
      summary,
      selected,
      clickable,
      detached,
      first: typeof context.onSelectRow !== 'function' && aria.colIndex === 1,
      last: aria.colIndex === this.props.context.columns.length,
      'last-row': lastRow,
      compact: context.compact,
      comfortable: context.comfortable,
      'with-icon': context.showError(value, column, row),
      ...context.modifiers(value, column, row),
      ...(column.align ? { [column.align]: true } : {}),
    };
  }

  format(value, column, row) {
    const { context } = this.props;
    const format = getFormattedValue(context);
    return format(value, column, row);
  }

  parse() {
    const value = this.getValue();
    const { context, column, row } = this.props;
    const type = getType(value, column);
    const parser = context.parsers[type] || IDENTITY;
    return parser(value, column, row, context);
  }

  replaceRowValues(message) {
    if (typeof message !== 'string') return message;
    const { row, context } = this.props;

    return context.columns.reduce(
      (acc, col) =>
        acc.replace(
          new RegExp(`\\{${col.key}\\}`, 'g'),
          this.format(row[col.key || col], col, row)
        ),
      message
    );
  }

  startEditing(value) {
    const { row, column, context } = this.props;
    if (typeof context.onStartEditing === 'function') {
      const error = context.showError(value, column, row);
      context.onStartEditing(value, column, row, this.replaceRowValues(error));
    }
  }

  stopEditing(value) {
    this.setState({ editing: false });
    const { column, row, context } = this.props;
    if (typeof context.onStopEditing === 'function') {
      const error = context.showError(value, column, row);
      context.onStopEditing(value, column, row, this.replaceRowValues(error));
    }
  }

  handleClickEditButton() {
    this.setState({ editing: true });
  }

  handleChange(value) {
    this.setState({ value });
    this.propagateChange(value);
  }

  propagateChange(value) {
    const { column, row, context } = this.props;
    if (context.onChange) {
      const error = context.showError(value, column, row);
      context.onChange(value, column, row, this.replaceRowValues(error));
    }
  }

  renderValue() {
    const { render, column, row, context, inputProps } = this.props;
    const value = this.getValue();
    const type = getType(value, column);

    if (render) {
      const formatter = getFormatter(context, type);
      const format = x => formatter(x, column, row, context);
      return render(column, row, format);
    }
    const renderer = context.renderers[type] || IDENTITY;

    switch (type) {
      case 'error':
        return renderer(value, column, row, context);
      case 'list': {
        const itemSelected =
          (inputProps.options || []).find(option => option.value === value) || {};
        return renderer(itemSelected.title, column, row, context);
      }
      default:
        return renderer(this.getFormattedValue(), column, row, context);
    }
  }

  renderContent() {
    const { id, column, row, render, editable, disabled, header, context, inputProps } = this.props;
    const { editing } = this.state;
    if (!context.visible(column, row)) {
      return null;
    }
    const value = this.getValue();
    const parsedValue = this.parse(value);

    const type = getType(value, column);
    const isDate = type === 'date' || type === 'datetime';
    const isList = type === 'list' || type === 'select';
    const modifiers = this.getModifiers();
    const ContentComponent = editable ? 'button' : 'div';

    const content = !['boolean'].includes(type) && (
      <ContentComponent
        id={editable && id ? `${id}__button` : undefined}
        ref={this.setContentNode}
        disabled={disabled}
        className={bemClass('DatagridCell__content', modifiers)}
        onClick={editable ? this.handleClickEditButton : undefined}
      >
        {isDate && editable === true && <Calendar className="DatagridCell__content-icon-left" />}
        <span className="DatagridCell__content-value">{this.renderValue()}</span>
        {isList && editable === true && <CaretDown className="DatagridCell__content-icon-right" />}
      </ContentComponent>
    );

    if (render) {
      return content;
    }

    return (
      <>
        <DataGridCellError
          column={column}
          row={row}
          value={value}
          showError={context.showError}
          isWarningError={context.isWarningError}
          replaceRowValues={this.replaceRowValues}
        />
        {content}
        {!header && !(!editable && !['boolean'].includes(type)) && (
          <DatagridCellInput
            id={`${id}__input`}
            context={context}
            column={column}
            value={parsedValue}
            type={type}
            inputProps={{ ...inputProps, readOnly: !editable }}
            onChange={this.handleChange}
            onStartEditing={this.startEditing}
            onStopEditing={this.stopEditing}
            modifiers={this.getModifiers()}
            editing={editing}
          />
        )}
        {!header && column.cellDropdownItems && column.cellDropdownItems.length && (
          <Dropdown
            id={`${id}__column-dropdown`}
            items={column.cellDropdownItems}
            end
            onClick={item => context.onClickCellDropdownItem(item, value, row, column)}
            renderTrigger={(onClick, open, ref) => (
              <span ref={ref}>
                <OptionsIcon onClick={onClick} />
              </span>
            )}
          />
        )}
      </>
    );
  }

  render() {
    const { aria, column, context } = this.props;
    const style = this.getStyle();
    const modifiers = this.getModifiers();
    const value = this.getFormattedValue();
    const tooltipVisible =
      typeof context.tooltipVisible === 'function' ? context.tooltipVisible(column) : true;

    return (
      <div
        className={bemClass('DatagridCell', modifiers, this.props.className)}
        title={tooltipVisible ? getTitleValue(value) : ''}
        ref={this.cellRef}
        style={style}
        role="gridcell"
        aria-rowindex={aria.rowIndex}
        aria-colindex={aria.colIndex}
      >
        <div className="DatagridCell__container" style={style}>
          {this.renderContent()}
        </div>
      </div>
    );
  }
}

DatagridCell.displayName = 'DatagridCell';

DatagridCell.defaultProps = {
  clickable: false,
  comfortable: false,
  compact: false,
  context: {},
  detached: false,
  disabled: false,
  editable: false,
  edited: false,
  header: false,
  lastRow: false,
  row: {},
  summary: false,
  width: 150,
};

DatagridCell.propTypes = {
  id: PropTypes.string,
  column: PropTypes.shape({
    key: PropTypes.any.isRequired,
    title: PropTypes.any.isRequired,
    description: PropTypes.string,
    type: PropTypes.string,
    formula: PropTypes.string,
    formatter: PropTypes.func,
  }),
  context: PropTypes.shape({
    onChangeDebounceTime: PropTypes.number,
    onChange: PropTypes.func,
    renderers: PropTypes.object,
    formatters: PropTypes.object,
    parsers: PropTypes.object,
    labels: PropTypes.shape({
      errorFormula: PropTypes.string,
    }),
    locale: PropTypes.string,
    onStartEditing: PropTypes.func,
    onClickCellDropdownItem: PropTypes.func.isRequired,
    compact: PropTypes.bool,
    comfortable: PropTypes.bool,
    columns: PropTypes.array,
  }),
  aria: PropTypes.shape({
    rowIndex: PropTypes.number.isRequired,
    colIndex: PropTypes.number.isRequired,
  }).isRequired,
  className: PropTypes.string,
  clickable: PropTypes.bool,
  colIndex: PropTypes.number,
  comfortable: PropTypes.bool,
  compact: PropTypes.bool,
  detached: PropTypes.bool,
  disabled: PropTypes.bool,
  editable: PropTypes.bool,
  edited: PropTypes.bool,
  header: PropTypes.bool,
  inputProps: PropTypes.object,
  lastRow: PropTypes.bool,
  render: PropTypes.func,
  row: PropTypes.object,
  rowIndex: PropTypes.number,
  selectedRowKey: PropTypes.string,
  summary: PropTypes.bool,
  width: PropTypes.number,
};

export default DatagridCell;
