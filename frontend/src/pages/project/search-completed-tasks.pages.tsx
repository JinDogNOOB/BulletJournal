import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IState } from '../../store';
import { Project } from '../../features/project/interface';
import { connect } from 'react-redux';
import { Avatar, DatePicker, Divider, Select, Tooltip } from 'antd';
import {
  TeamOutlined,
  SyncOutlined,
  UpSquareOutlined,
} from '@ant-design/icons';
import moment from 'moment';
import { getGroup } from '../../features/group/actions';
import { User, Group } from '../../features/group/interface';
import { useParams } from 'react-router-dom';
import { getProject } from '../../features/project/actions';
import { getSearchCompletedTasks } from '../../features/tasks/actions';
import { Task } from '../../features/tasks/interface';
import TaskItem from '../../components/project-item/task-item.component';

const { RangePicker } = DatePicker;
const { Option } = Select;

type SearchCompletedTasksProps = {
  project: Project | undefined;
  group: Group | undefined;
  timezone: string;
  searchCompletedTasks: Task[];
  getGroup: (groupId: number) => void;
  getProject: (projectId: number) => void;
  getSearchCompletedTasks: (
    projectId: number,
    assignee: string,
    startDate: string,
    endDate: string,
    timezone: string
  ) => void;
};

const SearchCompletedTasksPage: React.FC<SearchCompletedTasksProps> = (
  props
) => {
  const {
    project,
    timezone,
    group,
    searchCompletedTasks,
    getGroup,
    getProject,
    getSearchCompletedTasks,
  } = props;

  const { projectId } = useParams();
  const [users, setUsers] = useState([] as User[]);
  const [Date, setDate] = useState([
    moment().startOf('month').format('YYYY-MM-DD'),
    moment().endOf('month').format('YYYY-MM-DD'),
  ]);
  const [user, setUser] = useState('Everyone');

  const history = useHistory();

  useEffect(() => {
    if (projectId) {
      getProject(parseInt(projectId));
    }
  }, []);

  useEffect(() => {
    if (project) getGroup(project.group.id);
  }, [project]);

  useEffect(() => {
    if (group) setUsers(group.users);
  }, [group]);

  const handleRangeChange = (dates: any, dateStrings: string[]) => {
    setDate([dateStrings[0], dateStrings[1]]);
  };

  const handleGetCompeletedTask = () => {
    if (!project) return;
    getSearchCompletedTasks(project.id, user, Date[0], Date[1], timezone);
  };

  return (
    <div className='project'>
      <div>
        <RangePicker
          ranges={{
            Today: [moment(), moment()],
            'This Week': [moment().startOf('week'), moment().endOf('week')],
            'This Month': [moment().startOf('month'), moment().endOf('month')],
          }}
          value={[moment(Date[0]), moment(Date[1])]}
          onChange={handleRangeChange}
          allowClear={false}
        ></RangePicker>
        <Tooltip title='Select User'>
          <Select
            style={{ width: '150px' }}
            placeholder='Select User'
            value={user}
            onChange={(value: string) => {
              setUser(value);
            }}
          >
            <Option value='Everyone' key='Everyone'>
              <TeamOutlined style={{ fontSize: '20px' }} />
              &nbsp;&nbsp;&nbsp;&nbsp;<strong>Everyone</strong>
            </Option>
            {users.map((user) => {
              return (
                <Option value={user.name} key={user.name}>
                  <Avatar size='small' src={user.avatar} />
                  &nbsp;&nbsp; <strong>{user.alias}</strong>
                </Option>
              );
            })}
          </Select>
        </Tooltip>
        <Tooltip title='Refresh'>
          <span onClick={handleGetCompeletedTask}>
            <SyncOutlined />
          </span>
        </Tooltip>
        <Tooltip title='Go to Parent BuJo'>
          <UpSquareOutlined
            onClick={(e) => history.push(`/projects/${projectId}`)}
          />
        </Tooltip>
      </div>
      <Divider />
      <div>
        {searchCompletedTasks.map((t) => {
          return (
            <TaskItem
              task={t}
              isComplete={true}
              readOnly={false}
              inProject={true}
              completeOnlyOccurrence={false}
            />
          );
        })}
      </div>
    </div>
  );
};

const mapStateToProps = (state: IState) => ({
  project: state.project.project,
  group: state.group.group,
  timezone: state.myself.timezone,
  searchCompletedTasks: state.task.searchCompletedTasks,
});

export default connect(mapStateToProps, {
  getGroup,
  getProject,
  getSearchCompletedTasks,
})(SearchCompletedTasksPage);
