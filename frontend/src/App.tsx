import React from 'react';
import { Layout, Menu, Input } from 'antd';
import './App.less';
import createStore from './store';
import { Provider } from 'react-redux';
import { ToastContainer } from 'react-toastify';
import UserInfo from './features/user-info/UserInfo';

const store = createStore();

const { Header, Content, Footer, Sider } = Layout;
const { Search } = Input;

class App extends React.Component {
  render() {
    return (
      <Provider store={store}>
      <div className="App">
        <Layout className="layout">
          <Sider width={249} className="sider">
            <div className="sider-header">
              <img src="favicon466.ico" alt="Icon" className="icon-img" />
              <div className="title">
                <h2>Bullet Journal</h2>
              </div>
            </div>
            <Menu
              mode="inline"
              defaultSelectedKeys={['today']}
              style={{height: '100%' }}
            >
              <Menu.Item key="today">Today</Menu.Item>
              <Menu.Item key="next7days">Next 7 days</Menu.Item>
              <Menu.Item key="projects">Projects</Menu.Item>
              <Menu.Item key="groups">Groups</Menu.Item>
              <Menu.Item key="labels">Labels</Menu.Item>
            </Menu>
          </Sider>
            <Layout style={{marginLeft : '250px'}}>
              <Header className="header">
                <div className="search-box">
                  <Search />
                </div>
                <UserInfo />
              </Header>
              <Content style={{ padding: '0 24px', minHeight: 280 }}>
                Content
              </Content>
              <ToastContainer />
              <Footer style={{ textAlign: 'center' }}>
                Bullet Journal ©2020 Created by{' '}
              </Footer>
            </Layout>
        </Layout>
      </div>
      </Provider>
    );
  }
}

export default App;
