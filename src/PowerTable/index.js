import React from 'react';
import { findDOMNode } from 'react-dom';
import worker from './fetch.worker';
import update from 'immutability-helper';
import ScrollArea from './ScrollArea';
import Paginate from '../paginate/Paginate';


class PowerTable extends React.Component {

  constructor(props){
    super(props);
    this.worker = null;
    this.workerInstace = new Blob(['(' + worker.toString() + ')()'], {
      type: 'text/javascript'
    });
    this.workerReturn = this.workerReturn.bind(this);

    this.paginate = this.paginate.bind(this);
    this.filter = this.filter.bind(this);
    this.filterDistinct = this.filterDistinct.bind(this);
    this.sort = this.sort.bind(this);
    this.selectColumn = this.selectColumn.bind(this);

    this.node = null;
    this.offset = 0;

    this.columns = React.Children.map(props.children, (child) => {
      return {
        title: child.props.columnTitle,
        key: child.props.dataKey,
        formatter: child.props.formatter,
        searchable: child.props.searchable,
      };
    });

    this.state = {
      activeColumn: null,
      collection: [],
      message: '',
      count: 0,
      filters: {},
      loading: true,
      sorts: {},
    };

  }

  componentDidMount() {
    this.worker = new Worker(window.URL.createObjectURL(this.workerInstace));

    this.worker.addEventListener('message', (e) => {
      this.workerReturn(e);
    }, false);

    this.worker.postMessage(
      {
        action: 'LOAD',
        url: 'http://localhost:9000/data_collection-1.1.6.js',
        dataUrl: this.props.dataUrl,
        fetchMethod: this.props.fetchMethod,
        cols: this.columns.map((col) => {
          if(col.key) {
            return {key: col.key, searchable: col.searchable};
          }
        }),
      }
    );

    this.node = findDOMNode(this);
  }

  componentWillUnmount() {
    this.worker.terminate();
  }

  workerReturn(e) {

    const updateMessage = (message) => {
      const newState = update(this.state, {message: {$set: message}});
      this.setState(newState);
    };

    const refreshState = () => {
      const newState = update(this.state, {
        collection: {$set: e.data.itens},
        message: {$set: e.data.message},
        count: {$set: e.data.count},
        filters: {$set: e.data.filters},
        loading: {$set: false},
        sorts: {$set: e.data.sorts},
      });
      this.setState(newState);
    };

    switch (e.data.type) {
      case 'LOADING_INIT':
        updateMessage(e.data.message);
        break;
      case 'LOADING_ERROR':
        updateMessage(e.data.message);
        break;
      case 'LOADING':
        updateMessage(e.data.message);
        break;
      case 'LOADED':
        refreshState.call(this);
        break;
      case 'PAGINATE':
        refreshState.call(this);
        break;
      case 'SORT':
        this.refs.paginate.reset();
        refreshState.call(this);
        break;
      case 'FILTER':
        refreshState.call(this);
        break;
      case 'DISTINCT':
        this.setState(update(this.state, {distincts: {$set: e.data.itens}}));
        break;
    }
  }


  paginate(pagerObject) {
    const { currentPage, offset } = pagerObject;
    this.worker.postMessage({ action: 'PAGINATE', currentPage, offset });
  }

  filter(filterProps) {
    this.worker.postMessage({ action: 'FILTER', filterProps});
  }

  sort(direction, dataKey) {
    this.worker.postMessage({ action: 'SORT', direction, dataKey});
  }

  selectColumn(dataKey) {
    let activeColumn = dataKey === this.state.activeColumn ? null : dataKey;
    const newState = update(this.state, {activeColumn: {$set: activeColumn}});
    this.setState(newState);
  }

  filterDistinct(filterProps) {
    this.worker.postMessage({ action: 'FILTER_DISTINCT', filterProps});
  }

  render() {

    let opts = {
      collection: this.state.collection,
      columns: this.columns,
      container: this.node,
      itensInViewPort: this.props.itensInViewPort,
      onScroll: this.paginate,
      rowHeight: this.props.rowHeight,
      totalRecords: this.state.count,
    };

    let headers = this.props.children.map((chield, i) => {

      let newProps = {key: i};
      if(chield.props.dataKey){
        newProps.onSearch = this.filter;
        newProps.onSort = this.sort;
        newProps.filters = this.state.filters;
        newProps.sorts = this.state.sorts;
        newProps.container = this.node;
        newProps.onSelect = this.selectColumn;
        newProps.onFilterDistinct = this.filterDistinct;
        newProps.uniqueValues = this.state.distincts;
        newProps.activeColumn = this.state.activeColumn;
      }
      let props = {...chield.props, ...newProps};

      return React.cloneElement(chield, props);
    });

    let scrollableArea = this.state.collection.length ?
      (<ScrollArea {...opts} />) : (this.state.loading ? '' : <div>Nenhum Registro Encontrado.</div>);

    return (
      <div>
        <p>{this.state.message || ' '}</p>
        <div className='PWT-TableHeader' style={{backgroundColor: '#f3f3f3'}}>
          <table className='sv-table with--hover with--grid' style={{tableLayout: 'fixed'}}>
            <thead>
            <tr>
              {headers}
            </tr>
            </thead>
          </table>
        </div>
        {scrollableArea}
        <div className='sv-padd-25'>
          <Paginate
            onNextPage={this.paginate}
            onPreviousPage={this.paginate}
            onSelectASpecifPage={this.paginate}
            recordsByPage={16}
            ref='paginate'
            totalSizeOfData={this.state.count}
          />
        </div>

      </div>
    );
  }

}

PowerTable.displayName = 'PowerTable';

PowerTable.defaultProps = {
  fetchMethod: 'GET',
};

PowerTable.propTypes = {
  dataUrl: React.PropTypes.string.isRequired,
  fetchMethod: React.PropTypes.oneOf(['GET', 'POST']),
  fetchParams: React.PropTypes.object,
  itensInViewPort: React.PropTypes.number.isRequired,
  rowHeight: React.PropTypes.number.isRequired,
};

export default PowerTable;
