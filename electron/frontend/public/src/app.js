const { combineReducers, bindActionCreators, createStore, applyMiddleware } = Redux;
const { connect, Provider } = ReactRedux;

let testIncludes = (array) => {
  return (key) => array.includes(key);
};

const rootReducer = combineReducers({
  config: configReducer,
  data: dataReducer,
  status: statusReducer,
  latest: latestReducer
});

const mapStateToProps = (state) => ({
  config: state.config,
  data: state.data,
  status: state.status,
  latest: state.latest
});

const mapDispatchToProps = (dispatch) => {
  return bindActionCreators({
    getConfig: getConfig,
    modifyConfig: modifyConfig,
    getData: getData,
    refreshData: refreshData,
    clearData: clearData,
    cancelFetch: cancelFetch,
    getStatus: getStatus,
    getLatestBlocks: getLatestBlocks,
    restartSync: restartSync,
    restartRpc: restartRpc
  }, dispatch);
};

const store = createStore(rootReducer, applyMiddleware(thunk));
const Container = connect(mapStateToProps, mapDispatchToProps)(Home);

const App = () => {
  return (
    <Provider store={store}>
      <Container />
    </Provider>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
