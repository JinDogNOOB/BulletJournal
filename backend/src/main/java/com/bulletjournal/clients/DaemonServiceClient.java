package com.bulletjournal.clients;

import com.bulletjournal.protobuf.daemon.grpc.services.DaemonGrpc;
import com.bulletjournal.protobuf.daemon.grpc.types.JoinGroupEvents;
import com.bulletjournal.protobuf.daemon.grpc.types.ReplyMessage;
import com.bulletjournal.protobuf.daemon.grpc.types.StreamMessage;
import com.bulletjournal.protobuf.daemon.grpc.types.SubscribeNotification;
import io.grpc.StatusRuntimeException;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class DaemonServiceClient {

    private static final Logger LOGGER = LoggerFactory.getLogger(DaemonServiceClient.class);

    @GrpcClient("daemonClient")
    private DaemonGrpc.DaemonBlockingStub daemonBlockingStub;

    @GrpcClient("daemonClient")
    private DaemonGrpc.DaemonStub daemonAsyncStub;

    public String sendEmail(JoinGroupEvents joinGroupEvents) {
        try {
            ReplyMessage replyMessage = this.daemonBlockingStub.joinGroupEvents(joinGroupEvents);
            return replyMessage.getMessage();
        } catch (final StatusRuntimeException e) {
            LOGGER.error("Failed with " + e.getStatus().getCode().name());
            return null;
        }
    }

    public void subscribeNotification(SubscribeNotification subscribeNotification, StreamObserver<StreamMessage> responseObserver) {
        while (true) {
            try {
                LOGGER.info("Start subscribing to daemon server");
                this.daemonAsyncStub.subscribeNotification(subscribeNotification, responseObserver);
                break;
            } catch (final StatusRuntimeException e) {
                LOGGER.error("Failed with " + e.getStatus().getCode().name());
                long wait = 10000L;
                LOGGER.info("Will retry subscribing to daemon server again in {}s", wait / 1000);
                try {
                    Thread.sleep(wait);
                } catch (InterruptedException interruptedException) {
                    LOGGER.info("Internal error happened when subscribing to daemon server: {}", interruptedException.getMessage());
                }
            }
        }
    }

}
