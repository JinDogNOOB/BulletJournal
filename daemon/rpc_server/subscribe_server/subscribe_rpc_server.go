package subscribe_server

import (
	"container/list"
	"context"
	"errors"
	"fmt"
	daemon "github.com/singerdmx/BulletJournal/daemon/api/service"
	"github.com/singerdmx/BulletJournal/daemon/consts"
	"github.com/singerdmx/BulletJournal/daemon/logging"
	"github.com/singerdmx/BulletJournal/protobuf/daemon/grpc/services"
	"github.com/singerdmx/BulletJournal/protobuf/daemon/grpc/types"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"strconv"
	"sync"
	"time"
)

const (
	DEFAULT_RETRY_INTERVAL = 5 * time.Second // in second
)

var (
	logger logging.Logger
)

type SubscribeRpcServer struct {
	services.UnimplementedDaemonServer
	fanInChannel chan *daemon.StreamingMessage
	sessionProvider *sessionProvider
}

type streamHandle struct {
	stream *services.Daemon_SubscribeNotificationServer
	clientId string
	errorChan chan error
}

type sessionProvider struct {
	// store *streamHandle in list actually
	sessionMap map[string] *list.Element
	sessionList list.List
	currSession *list.Element
	mux sync.Mutex
}


func (provider *sessionProvider) registerSession(
	clientId string,
	stream services.Daemon_SubscribeNotificationServer,
) (<-chan error, error) {
	provider.mux.Lock()
	defer provider.mux.Unlock()
	errorChan := make(chan error)
	if _, ok := provider.sessionMap[clientId]; ok {
		errorMsg := fmt.Sprintf("Session with clientId: %s in request already exists", clientId)
		logger.Errorf(errorMsg)
		return nil, status.Error(codes.AlreadyExists, errorMsg)
	} else {
		provider.sessionList.PushBack(&streamHandle{stream: &stream, clientId: clientId, errorChan: errorChan})
		provider.sessionMap[clientId] = provider.sessionList.Back()
		return errorChan, nil
	}
}


// return next established session (stream) in a round robin manner
func (provider *sessionProvider) getNextSession() *streamHandle {
	// no need to lock here, if there is a race condition, we will get the new session in next retry
	for provider.sessionList.Len() == 0 {
		logger.Warnf("No available RPC session, retry scheduled in %v", DEFAULT_RETRY_INTERVAL)
		time.Sleep(DEFAULT_RETRY_INTERVAL)
	}
	provider.mux.Lock()
	defer provider.mux.Unlock()

	if provider.currSession == nil || provider.currSession.Next() == nil {
		provider.currSession = provider.sessionList.Front()
	} else {
		provider.currSession = provider.currSession.Next()
	}
	// TODO: remove this log line
	logger.Infof("current session is: %v", provider.currSession.Value.(*streamHandle).clientId)
	logger.Infof(provider.getSessionDump())
	return provider.currSession.Value.(*streamHandle)
}


// remove session, explicitly close connection from server side by send an error
// to error channel, this will make the RPC call to return in error state
func (provider *sessionProvider) terminateSession(clientId string, reason string) error {
	provider.mux.Lock()
	defer provider.mux.Unlock()

	sessionToDelete, ok := provider.sessionMap[clientId]
	if !ok {
		return errors.New(
			fmt.Sprintf("Cannot delete non-exist session for ClientId: %s", clientId))
	}
	delete(provider.sessionMap, clientId)
	if provider.currSession == sessionToDelete {
		provider.currSession = provider.currSession.Next()
	}
	provider.sessionList.Remove(sessionToDelete)
	sessionToDelete.Value.(*streamHandle).errorChan <- status.Error(codes.Internal, reason)
	return nil
}


func (provider *sessionProvider) terminateAllSessions() {
	for clientId, _ := range provider.sessionMap {
		provider.terminateSession(clientId, "Terminate all connected sessions")
	}
}


func (provider *sessionProvider) getSessionDump() string {
	ret := "\n\t------- Session Provider dump: --------"
	ret += "\n\tConnected ClientId: {"
	for clientId, _ := range provider.sessionMap {
		ret += clientId + ", "
	}
	ret += "}"
	ret += "\n\tCurrent Session Pointer: " + provider.currSession.Value.(*streamHandle).clientId
	ret += "\n\tSession List: {"
	curr := provider.sessionList.Front()
	for curr != nil {
		ret += curr.Value.(*streamHandle).clientId + ", "
		curr = curr.Next()
	}
	ret += "}"
	return ret
}


func NewServer(fanInChannel chan *daemon.StreamingMessage) *SubscribeRpcServer {
	logger = *logging.GetLogger()
	logger.Infof("Create SubscribeRpcServer")
	return &SubscribeRpcServer{
		fanInChannel: fanInChannel,
		sessionProvider: &sessionProvider{
			sessionMap: map[string]*list.Element{},
			sessionList: list.List{},
		},
	}
}


// Start a go routine to dispatch all incoming messages, each of them is going to be sent
// via one of registered RPC sessions, we pick next available session in a round robin manner
func (s *SubscribeRpcServer) StartDispatcher() {
	go func() {
		logger.Infof("Start subscribe RPC dispatcher go routine")
		for msg := range s.fanInChannel {
			session := s.sessionProvider.getNextSession()
			switch msg.ServiceName {
			case consts.CLEANER_SERVICE_NAME:
				if err :=s.sendCleanerServiceNotification(session, msg); err != nil {
					s.handleDispatchingError(session, msg)
				}
			case consts.INVESTMENT_SERVICE_NAME:
				if err := s.sendInvestmentServiceNotification(session, msg); err != nil {
					s.handleDispatchingError(session, msg)
				}
			case consts.REMINDER_SERVICE_NAME:
				logger.Infof("RPC logic for Reminder Service is not implemented")
			default:
				logger.Infof("Unsupported service type: %s", msg.ServiceName)
			}
		}
		logger.Infof("fanInChannel closed, stop dispatcher")
	}()
}


func (s *SubscribeRpcServer) handleDispatchingError(session *streamHandle, msg *daemon.StreamingMessage) {
	if err := s.sessionProvider.terminateSession(
		session.clientId, "Failed to send message through this session, close it."); err != nil {
		logger.Error(err.Error())
	}
	logger.Infof("Failed to send message: {%v, %v}, put into the queue again",
		msg.ServiceName, msg.Message)
	s.fanInChannel <- msg
}


func (s *SubscribeRpcServer) dumpState() {
	logger.Infof("\n=========== Dump SubscribeRpcServer State ===========\n" +
	             "\tfanInBuffer size: %v" +
	             "\n%v" +
				 "\n======================= Done =========================",
	             len(s.fanInChannel), s.sessionProvider.getSessionDump())
}


func (s *SubscribeRpcServer) Stop() {
	logger.Infof("Stop SubscribeRpcServer")
	s.dumpState()
	s.sessionProvider.terminateAllSessions()
}


func (s *SubscribeRpcServer) sendInvestmentServiceNotification(
	handle *streamHandle,
	msg *daemon.StreamingMessage,
) error {
	sampleTaskId := msg.Message
	return (*handle.stream).Send(
		&types.NotificationStreamMsg{
			Body: &types.NotificationStreamMsg_SampleTaskMsg{
				SampleTaskMsg: &types.SubscribeSampleTaskMsg{SampleTaskId: sampleTaskId},
			},
		},
	)
}


func (s *SubscribeRpcServer) sendCleanerServiceNotification(
	handle *streamHandle,
	msg *daemon.StreamingMessage,
) error {
	projectId := strconv.Itoa(int(msg.Message))
	return (*handle.stream).Send(
		&types.NotificationStreamMsg{
			Body: &types.NotificationStreamMsg_RenewGoogleCalendarWatchMsg{
				RenewGoogleCalendarWatchMsg:
					&types.SubscribeRenewGoogleCalendarWatchMsg{GoogleCalendarProjectId: projectId},
			},
		},
	)
}


func (s *SubscribeRpcServer) HealthCheck(
	ctx context.Context, request *types.HealthCheckRequest,
) (*types.HealthCheckResponse, error) {
	return &types.HealthCheckResponse{}, nil
}


func (s *SubscribeRpcServer) SubscribeNotification(
	requestMsg *types.SubscribeNotificationMsg,
	stream services.Daemon_SubscribeNotificationServer,
) error {
	clientId := requestMsg.GetClientId()
	logger.Infof("Received rpc subscribe request: {%s}", requestMsg.String())
	logger.Infof("Client: %s joining subscription service", clientId)
	if clientId == "" {
		errorMsg := "ClientId cannot be empty, reject request"
		logger.Error(errorMsg)
		return status.Error(codes.InvalidArgument, errorMsg)
	}
	errorChan, err := s.sessionProvider.registerSession(clientId, stream)
	if err != nil {
		return err
	}
	// block the rpc call here to keep the stream open
	err = <-errorChan
	logger.Infof("Closing subscribe streaming for ClientId: %s due to: %v", clientId, err)
	return err
}
