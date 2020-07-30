package com.bulletjournal.repository;

import com.bulletjournal.repository.models.User;
import com.bulletjournal.repository.models.UserPointActivity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Repository
public class UserPointActivityDaoJpa {

    @Autowired
    private UserPointActivityRepository userPointActivityRepository;

    @Transactional(rollbackFor = Exception.class, propagation = Propagation.REQUIRED)
    public UserPointActivity create(User user, Integer point, String description) {
        UserPointActivity userPointActivity = new UserPointActivity(user, point, description);
        userPointActivityRepository.save(userPointActivity);
        return userPointActivity;
    }

    @Transactional(rollbackFor = Exception.class, propagation = Propagation.REQUIRED)
    public List<com.bulletjournal.controller.models.UserPointActivity> findPointActivityByUserName(String username) {
        return userPointActivityRepository.findUserPointActivitiesByUser(username)
                .stream().map(e -> e.toPresentationModel()).collect(Collectors.toList());
    }
}
