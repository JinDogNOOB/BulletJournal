import React, {useEffect, useState} from 'react';
import './steps.styles.less';
import {useHistory} from "react-router-dom";
import {IState} from "../../store";
import {connect} from "react-redux";
import {Avatar, Button, Checkbox, DatePicker, Result, Select, Tooltip} from "antd";
import {Project, ProjectsWithOwner} from "../../features/project/interface";
import {flattenOwnedProject, flattenSharedProject} from "../projects/projects.pages";
import {ProjectType} from "../../features/project/constants";
import AddProject from "../../components/modals/add-project.component";
import {iconMapper} from "../../components/side-menu/side-menu.component";
import {getCookie} from "../../index";
import {Group} from "../../features/group/interface";
import {getGroup} from "../../features/group/actions";
import {onFilterAssignees, onFilterLabel} from "../../utils/Util";
import {labelsUpdate} from "../../features/label/actions";
import {Label} from "../../features/label/interface";
import {getIcon} from "../../components/draggable-labels/draggable-label-list.component";
import {ReminderBeforeTaskText} from "../../components/settings/reducer";
import {QuestionCircleTwoTone} from "@ant-design/icons";

const {Option} = Select;

type StepsImportTasksProps = {
    myself: string;
    labelOptions: Label[];
    before: number;
    ownedProjects: Project[];
    sharedProjects: ProjectsWithOwner[];
    group: Group | undefined;
    getGroup: (groupId: number) => void;
    labelsUpdate: (projectId: number | undefined) => void;
};

const StepsImportTasksPage: React.FC<StepsImportTasksProps> = (
    {
        myself, labelOptions, ownedProjects, sharedProjects, group,
        before, getGroup, labelsUpdate
    }
) => {
    const history = useHistory();
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectId, setProjectId] = useState(-1);
    const [assignees, setAssignees] = useState<string[]>([]);
    const [labels, setLabels] = useState<number[]>([]);
    const [startDate, setStartDate] = useState(undefined);
    const [reminderBefore, setReminderBefore] = useState(before);
    const [subscribed, setSubscribed] = useState(true);

    function reset(project: Project) {
        setProjectId(project.id);
        getGroup(project.group.id);
        labelsUpdate(project.id);
        setAssignees([myself]);
        setLabels([]);
    }

    useEffect(() => {
        if (projects && projects[0]) {
            reset(projects[0]);
        } else {
            setProjectId(-1);
        }
    }, [projects]);

    useEffect(() => {
        setProjects([]);
        setProjects(flattenOwnedProject(ownedProjects, projects));
        setProjects(flattenSharedProject(sharedProjects, projects));
        setProjects(
            projects.filter((p) => {
                return p.projectType === ProjectType.TODO && !p.shared;
            })
        );
    }, [ownedProjects, sharedProjects]);

    const onGoSignIn = () => {
        window.location.href = 'https://bulletjournal.us';
    }

    const onChangeAssignees = (value: any) => {
        setAssignees(value);
    }

    const onChangeLabels = (value: any) => {
        setLabels(value);
    }

    const onChangeReminderBefore = (value: any) => {
        setReminderBefore(value);
    }

    const onChangeStartDate = (value: any) => {
        console.log(value);
        setStartDate(value);
    }

    const onChangeSubscribed = (value: any) => {
        setSubscribed(value.target.checked);
    }

    const getUserSelections = () => {
        if (!group || !group.users) {
            return null;
        }
        return (
            <>
                <Select
                    mode="multiple"
                    allowClear={true}
                    onChange={onChangeAssignees}
                    filterOption={(e, t) => onFilterAssignees(e, t)}
                    value={assignees}
                    style={{padding: '3px', minWidth: '50%'}}
                >
                    {group.users
                        .filter((u) => u.accepted)
                        .map((user) => {
                            return (
                                <Option value={user.name} key={user.alias}>
                                    <Avatar size="small" src={user.avatar}/>
                                    &nbsp;&nbsp; <strong>{user.alias}</strong>
                                </Option>
                            );
                        })}
                </Select>
                <Button
                    onClick={() => setAssignees(group!.users.map(u => u.name))}
                    style={{color: '#4ddbff'}} shape="round" size='small'>
                    All
                </Button></>
        );
    };

    const loginCookie = getCookie('__discourse_proxy');

    if (!loginCookie) {
        return <Result
            status="warning"
            title="Please Sign In"
            subTitle="You need a Bullet Journal account to save these tasks into your own project (BuJo)"
            extra={
                <Button type="primary" key="sign-in" onClick={onGoSignIn}>
                    Go to Bullet Journal Sign In Page
                </Button>
            }
        />
    }

    if (projects.length === 0) {
        return <div className='import-tasks-page'>
            <Result
                status="warning"
                title="Please Create a Project"
                subTitle="You need a TODO BuJo to save these events into it"
                extra={<AddProject history={history} mode={'singular'}/>}
            />
        </div>
    }

    return <div className='choices-card'>
        <div className='choice-card'>
            <span>Project (BuJo) to save these events into</span>
        </div>
        <div className='choice-card'>
            <Select
                style={{padding: '3px', minWidth: '40%'}}
                placeholder="Choose BuJo"
                value={projectId}
                onChange={(value: any) => {
                    reset(projects.filter(p => p.id === value)[0]);
                }}
            >
                {projects.map((project) => {
                    return (
                        <Option value={project.id} key={project.id}>
                            <Tooltip
                                title={`${project.name} (Group ${project.group.name})`}
                                placement="right"
                            >
                                <span>
                                  <Avatar size="small" src={project.owner.avatar}/>
                                    &nbsp; {iconMapper[project.projectType]}
                                    &nbsp; <strong>{project.name}</strong>
                                    &nbsp; (Group <strong>{project.group.name}</strong>)
                                </span>
                            </Tooltip>
                        </Option>
                    );
                })}
            </Select>
        </div>
        <div className='choice-card'>
            <span>Users that will be notified for event occurrence</span>
        </div>
        <div className='choice-card'>
            {getUserSelections()}
        </div>
        <div className='choice-card'>
            <span>Attach labels to these events</span>
        </div>
        <div className='choice-card'>
            <Select
                mode="multiple"
                placeholder='Labels'
                allowClear={true}
                style={{padding: '3px', minWidth: '50%'}}
                value={labels}
                onChange={onChangeLabels}
                filterOption={(e, t) => onFilterLabel(e, t)}
            >
                {labelOptions &&
                labelOptions.length &&
                labelOptions.map((l) => {
                    return (
                        <Option value={l.id} key={l.value}>
                            {getIcon(l.icon)} &nbsp;{l.value}
                        </Option>
                    );
                })}
            </Select>
            <Button
                onClick={() => setLabels(labelOptions.map(l => l.id))}
                style={{color: '#4ddbff'}} shape="round" size='small'>
                All
            </Button>
        </div>
        <div className='choice-card'>
            <span>When to start showing these events on your calendar (optional)</span>
        </div>
        <div className='choice-card'>
            <DatePicker
                allowClear={true}
                onChange={onChangeStartDate}
                style={{width: '180px', padding: '5px'}}
                placeholder="Start Date"
            />
        </div>
        <div className='choice-card'>
            <span>When to remind yourself before event happens</span>
        </div>
        <div className='choice-card'>
            <Select
                defaultValue={ReminderBeforeTaskText[before]}
                style={{width: '180px', padding: '5px'}}
                onChange={onChangeReminderBefore}
                placeholder="Reminder Before Event"
            >
                {ReminderBeforeTaskText.map((b: string, index: number) => (
                    <Option key={index} value={index}>
                        {b}
                    </Option>
                ))}
            </Select>
        </div>
        <div className='choice-card'>
            <Button
                style={{color: '#4ddbff', margin: '3px'}} shape="round">
                Import
            </Button>
        </div>
        <div className='subscribe-updates'>
            <Checkbox checked={subscribed} onChange={onChangeSubscribed}>Subscribe to future updates</Checkbox>
            <Tooltip title='New events will be added into your BuJo automatically'>
                <QuestionCircleTwoTone/>
            </Tooltip>
        </div>
    </div>

};

const mapStateToProps = (state: IState) => ({
    ownedProjects: state.project.owned,
    sharedProjects: state.project.shared,
    group: state.group.group,
    myself: state.myself.username,
    labelOptions: state.label.labelOptions,
    before: state.settings.before,
});

export default connect(mapStateToProps, {
    getGroup,
    labelsUpdate
})(StepsImportTasksPage);